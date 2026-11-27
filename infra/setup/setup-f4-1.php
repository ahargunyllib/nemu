<?php
// Sections 2 and 3 of the F4-1 guide (f4-1/F4-1_cara-pasang-di-moodle-uji.md) as a CLI script:
// the 15 questions of f4-1/F4-1_kuis-ipas-4a.xml in the 4A-UJI question bank, and the quiz
// "Kuis IPAS 4A: Energi, Gaya, dan Peta" in section IPAS with questions 01-15 in order.
// Safe to run again: it imports only questions that are missing and never touches an existing quiz,
// so the quiz's last-modified time stays what the F4-1 test recorded.
// Run it through ../setup-4a-uji.sh, after setup-4a-uji.php.

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/questionlib.php');
require_once($CFG->dirroot . '/question/format.php');
require_once($CFG->dirroot . '/question/format/xml/format.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');

const F41_QUIZ = 'Kuis IPAS 4A: Energi, Gaya, dan Peta';
const F41_CATEGORY = 'Kuis Latihan IPAS 4A';
// Soal 07 has no correct answer on purpose; "setrika" is the answer the teacher meant.
const F41_NO_KEY = 'Soal 07';
const F41_MEANT = 'setrika';

\core\session\manager::set_user(get_admin());
set_config('noemailever', 1);
$CFG->noemailever = true;

$course = $DB->get_record('course', ['shortname' => '4A-UJI'], '*', MUST_EXIST);
$bank = \core_question\local\bank\question_bank_helper::get_default_open_instance_system_type($course, true);
$bankcontext = context_module::instance($bank->id);

/** The latest version of each question in the F4-1 category, by name ("Soal 01" => question id). */
function f41_questions(context $bankcontext): array {
    global $DB;
    $category = $DB->get_record('question_categories',
        ['contextid' => $bankcontext->id, 'name' => F41_CATEGORY]);
    if (!$category) {
        return [];
    }
    $rows = $DB->get_records_sql(
        "SELECT q.id, q.name
           FROM {question} q
           JOIN {question_versions} qv ON qv.questionid = q.id
           JOIN {question_bank_entries} qbe ON qbe.id = qv.questionbankentryid
          WHERE qbe.questioncategoryid = ?
            AND qv.version = (SELECT MAX(v.version) FROM {question_versions} v
                               WHERE v.questionbankentryid = qbe.id)", [$category->id]);
    $questions = [];
    foreach ($rows as $row) {
        $questions[$row->name] = (int) $row->id;
    }
    ksort($questions);
    return $questions;
}

/**
 * Imports the questions of the XML that the bank doesn't have yet. With `$fallback`, soal 07 goes in
 * with "setrika" at 100% (the guide's way round a Moodle that refuses a question with no key).
 */
function f41_import(stdClass $course, context $bankcontext, array $have, bool $fallback): void {
    $xml = new DOMDocument();
    $xml->load(__DIR__ . '/f4-1/F4-1_kuis-ipas-4a.xml');
    foreach (iterator_to_array($xml->getElementsByTagName('question')) as $node) {
        if ($node->getAttribute('type') === 'category') {
            continue;
        }
        $name = trim($node->getElementsByTagName('name')->item(0)->textContent);
        if (isset($have[$name])) {
            $node->parentNode->removeChild($node);
        } else if ($fallback && $name === F41_NO_KEY) {
            foreach ($node->getElementsByTagName('answer') as $answer) {
                $text = $answer->getElementsByTagName('text')->item(0);
                if ($text && trim(strip_tags($text->textContent)) === F41_MEANT) {
                    $answer->setAttribute('fraction', '100');
                }
            }
        }
    }
    $file = make_request_directory() . '/F4-1_kuis-ipas-4a.xml';
    $xml->save($file);

    $format = new qformat_xml();
    $format->setCategory(question_get_default_category($bankcontext->id, true));
    $format->setContexts([$bankcontext]);
    $format->setCourse($course);
    $format->setFilename($file);
    $format->setRealfilename(basename($file));
    $format->setMatchgrades('error');
    $format->setCatfromfile(true);
    $format->setContextfromfile(true);
    $format->setStoponerror(true);
    $format->set_display_progress(false);
    ob_start();
    $ok = $format->importpreprocess() && $format->importprocess() && $format->importpostprocess();
    $output = trim(html_to_text(ob_get_clean(), 0, false));
    if (!$ok) {
        mtrace("Import stopped: {$output}");
    }
}

$questions = f41_questions($bankcontext);
if (count($questions) < 15) {
    f41_import($course, $bankcontext, $questions, false);
    $questions = f41_questions($bankcontext);
}
if (!isset($questions[F41_NO_KEY])) {
    mtrace('Moodle refused soal 07 without a key; importing it with the guide\'s fallback.');
    f41_import($course, $bankcontext, $questions, true);
    $questions = f41_questions($bankcontext);
}
if (count($questions) !== 15) {
    cli_error('Expected 15 F4-1 questions, found ' . count($questions) . ': ' . implode(', ', array_keys($questions)));
}
// The fallback's 100% goes back to 0 in the database, never through the edit form (guide 2.4).
$nokey = $questions[F41_NO_KEY];
if ($DB->record_exists_select('question_answers', 'question = ? AND fraction > 0', [$nokey])) {
    $DB->set_field('question_answers', 'fraction', 0, ['question' => $nokey]);
    question_bank::notify_question_edited($nokey);
}
mtrace('Question bank: ' . F41_CATEGORY . ' with 15 questions (soal 07 without a key, soal 15 without timbangan-3.png)');

// Section 3: the quiz in IPAS. The school is in WIB, so the site's time zone is Asia/Jakarta.
set_config('timezone', 'Asia/Jakarta');
$quiz = $DB->get_record('quiz', ['course' => $course->id, 'name' => F41_QUIZ]);
if ($quiz) {
    mtrace("Quiz: " . F41_QUIZ . " already exists (id {$quiz->id}); left as it is.");
} else {
    $generator = \core\test\phpunit\phpunit_util::get_data_generator();
    $quiz = $generator->create_module('quiz', [
        'course' => $course->id,
        'section' => 1,
        'name' => F41_QUIZ,
        'intro' => '<p>Latihan IPAS kelas 4A: energi, gaya, dan peta.</p>',
        'introformat' => FORMAT_HTML,
        'timeopen' => make_timestamp(2026, 12, 2, 7, 0, 0, 'Asia/Jakarta'),
        'timeclose' => make_timestamp(2026, 12, 4, 21, 0, 0, 'Asia/Jakarta'),
        'grade' => 100,
    ]);
    foreach ($questions as $questionid) {
        quiz_add_quiz_question($questionid, $quiz);
    }
    \mod_quiz\quiz_settings::create($quiz->id)->get_grade_calculator()->recompute_quiz_sumgrades();
    mtrace("Quiz: " . F41_QUIZ . " (cmid {$quiz->cmid}) in IPAS with soal 01-15");
}

$quiz = $DB->get_record('quiz', ['course' => $course->id, 'name' => F41_QUIZ], '*', MUST_EXIST);
$slots = $DB->count_records('quiz_slots', ['quizid' => $quiz->id]);
// Guide section 4: what "nothing changed" is checked against after the test.
mtrace('F4-1 baseline: timemodified ' . $quiz->timemodified . ' (' . userdate($quiz->timemodified, '%d %B %Y %H.%M', 'Asia/Jakarta') .
    "), {$slots} questions");
