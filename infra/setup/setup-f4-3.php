<?php
// Persiapan steps 2-5 of f4-3/F4-3_skenario.md as a CLI script: the 5 questions of
// f4-3/F4-3_kuis-my-family.xml in the 4A-UJI question bank, the quizzes "Latihan: My Family
// (has/have)" (MF 01-05) and the decoy "Parts of Body + Family (pengecoh)" (MF 01-02) in section
// Bahasa Inggris, and one finished, graded attempt on the first quiz by each of the three students.
// Safe to run again: it imports only missing questions, creates only a missing quiz, and adds an
// attempt only for a student without a finished one. After a test run deleted the quiz, running it
// again recreates the quiz and its 3 attempts.
// Run it through ../setup-4a-uji.sh, after setup-4a-uji.php.

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/questionlib.php');
require_once($CFG->dirroot . '/question/format.php');
require_once($CFG->dirroot . '/question/format/xml/format.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');

use mod_quiz\quiz_attempt;
use mod_quiz\quiz_settings;

const F43_CATEGORY = 'Latihan My Family';
const F43_QUIZ = 'Latihan: My Family (has/have)';
const F43_DECOY = 'Parts of Body + Family (pengecoh)';
const F43_STUDENTS = ['siswa.aisyah', 'siswa.bagas', 'siswa.citra'];
// "Jawabannya bebas": a different score for each, so the grades are easy to tell apart.
const F43_ANSWERS = [
    'siswa.aisyah' => ['have', 'has', 'have', 'has', 'have'],
    'siswa.bagas' => ['have', 'has', 'have', 'have', 'has'],
    'siswa.citra' => ['has', 'has', 'have', 'have', 'has'],
];

\core\session\manager::set_user(get_admin());
set_config('noemailever', 1);
$CFG->noemailever = true;
set_config('timezone', 'Asia/Jakarta');

$course = $DB->get_record('course', ['shortname' => '4A-UJI'], '*', MUST_EXIST);

// Moodle's first-use tours (the Mode Edit one among them) close the menu Nemu points into when
// dismissed. Testers know Moodle, so the test site shows none.
$DB->set_field('tool_usertours_tours', 'enabled', 0);
\tool_usertours\cache::notify_tour_change();
mtrace('User tours: off');
$bank = \core_question\local\bank\question_bank_helper::get_default_open_instance_system_type($course, true);
$bankcontext = context_module::instance($bank->id);

/** The latest version of each question in the F4-3 category, by name ("MF 01" => question id). */
function f43_questions(context $bankcontext): array {
    global $DB;
    $category = $DB->get_record('question_categories',
        ['contextid' => $bankcontext->id, 'name' => F43_CATEGORY]);
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

/** Imports the questions of the XML that the bank doesn't have yet. */
function f43_import(stdClass $course, context $bankcontext, array $have): void {
    $xml = new DOMDocument();
    $xml->load(__DIR__ . '/f4-3/F4-3_kuis-my-family.xml');
    foreach (iterator_to_array($xml->getElementsByTagName('question')) as $node) {
        if ($node->getAttribute('type') === 'category') {
            continue;
        }
        $name = trim($node->getElementsByTagName('name')->item(0)->textContent);
        if (isset($have[$name])) {
            $node->parentNode->removeChild($node);
        }
    }
    $file = make_request_directory() . '/F4-3_kuis-my-family.xml';
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

/** The quiz by name in 4A-UJI, unless Moodle is still deleting it (a deleted quiz waits for cron). */
function f43_quiz(stdClass $course, string $name): ?stdClass {
    global $DB;
    $quiz = $DB->get_record_sql(
        "SELECT q.*, cm.id AS cmid
           FROM {quiz} q
           JOIN {modules} m ON m.name = 'quiz'
           JOIN {course_modules} cm ON cm.instance = q.id AND cm.module = m.id
          WHERE q.course = ? AND q.name = ? AND cm.deletioninprogress = 0
       ORDER BY q.id DESC", [$course->id, $name], IGNORE_MULTIPLE);
    return $quiz ?: null;
}

$questions = f43_questions($bankcontext);
if (count($questions) < 5) {
    f43_import($course, $bankcontext, $questions);
    $questions = f43_questions($bankcontext);
}
if (array_keys($questions) !== ['MF 01', 'MF 02', 'MF 03', 'MF 04', 'MF 05']) {
    cli_error('Expected MF 01-05, found: ' . implode(', ', array_keys($questions)));
}
mtrace('Question bank: ' . F43_CATEGORY . ' with MF 01-05');

// Persiapan 3: both quizzes in Bahasa Inggris (section 2), times in WIB.
$generator = \core\test\phpunit\phpunit_util::get_data_generator();
$plan = [
    F43_QUIZ => ['opens' => [2026, 11, 30], 'closes' => [2026, 12, 4], 'questions' => ['MF 01', 'MF 02', 'MF 03', 'MF 04', 'MF 05']],
    F43_DECOY => ['opens' => [2026, 11, 23], 'closes' => [2026, 11, 27], 'questions' => ['MF 01', 'MF 02']],
];
foreach ($plan as $name => $spec) {
    if ($quiz = f43_quiz($course, $name)) {
        mtrace("Quiz: {$name} already exists (cmid {$quiz->cmid}); left as it is.");
        continue;
    }
    [$oy, $om, $od] = $spec['opens'];
    [$cy, $cm, $cd] = $spec['closes'];
    $quiz = $generator->create_module('quiz', [
        'course' => $course->id,
        'section' => 2,
        'name' => $name,
        'intro' => '<p>Latihan bahasa Inggris kelas 4A.</p>',
        'introformat' => FORMAT_HTML,
        'timeopen' => make_timestamp($oy, $om, $od, 7, 0, 0, 'Asia/Jakarta'),
        'timeclose' => make_timestamp($cy, $cm, $cd, 21, 0, 0, 'Asia/Jakarta'),
    ]);
    foreach ($spec['questions'] as $question) {
        quiz_add_quiz_question($questions[$question], $quiz);
    }
    quiz_settings::create($quiz->id)->get_grade_calculator()->recompute_quiz_sumgrades();
    mtrace("Quiz: {$name} (cmid {$quiz->cmid}) in Bahasa Inggris with " .
        implode(', ', $spec['questions']));
}

// Persiapan 4: each student starts, answers and submits the first quiz, as attempt.php and
// processattempt.php do. The quiz opens on 30 November, so this skips its time limits.
$quiz = f43_quiz($course, F43_QUIZ);
foreach (F43_STUDENTS as $username) {
    $student = $DB->get_record('user', ['username' => $username, 'deleted' => 0], '*', MUST_EXIST);
    if (quiz_get_user_attempts($quiz->id, $student->id, 'finished')) {
        mtrace("Attempt: {$username} already submitted; left as it is.");
        continue;
    }
    \core\session\manager::set_user($student);
    $attempt = quiz_get_user_attempt_unfinished($quiz->id, $student->id);
    if (!$attempt) {
        $previous = quiz_get_user_attempts($quiz->id, $student->id, 'all', true);
        $last = $previous ? end($previous) : null;
        $attempt = quiz_prepare_and_start_new_attempt(quiz_settings::create($quiz->id, $student->id),
            $last ? $last->attempt + 1 : 1, $last ?: null);
    }
    $attemptobj = quiz_attempt::create($attempt->id);
    // The form a student would send: the chosen answer's position and each question's sequence check.
    $post = ['slots' => implode(',', $attemptobj->get_slots())];
    foreach ($attemptobj->get_slots() as $slot) {
        $qa = $attemptobj->get_question_attempt($slot);
        $question = $qa->get_question();
        $wanted = F43_ANSWERS[$username][$slot - 1];
        foreach (array_values($question->get_order($qa)) as $position => $answerid) {
            if (trim(strip_tags($question->answers[$answerid]->answer)) === $wanted) {
                $post[$qa->get_qt_field_name('answer')] = (string) $position;
            }
        }
        $post[$qa->get_control_field_name('sequencecheck')] = (string) $qa->get_sequence_check_count();
    }
    $now = time();
    $attemptobj->process_submitted_actions($now, false, $post);
    $attemptobj->process_submit($now, false);
    $attemptobj->process_grade_submission($now);
    $finished = quiz_attempt::create($attempt->id);
    mtrace("Attempt: {$username} submitted, " . format_float($finished->get_sum_marks(), 0) . '/5');
}
\core\session\manager::set_user(get_admin());

// Persiapan 5: what the quiz's Hasil page shows, and the grades the test checks are still there.
$attempts = $DB->count_records_select('quiz_attempts', 'quiz = ? AND preview = 0 AND state = ?',
    [$quiz->id, quiz_attempt::FINISHED]);
$grades = $DB->count_records('quiz_grades', ['quiz' => $quiz->id]);
mtrace("F4-3 baseline: " . F43_QUIZ . " (cmid {$quiz->cmid}), {$attempts} finished attempts, {$grades} grades");
