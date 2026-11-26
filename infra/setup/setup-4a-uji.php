<?php
// Section 1 of Richard's F4-1_cara-pasang-di-moodle-uji.md as a CLI script, safe to run again:
// the Indonesian language pack, course 4A-UJI with sections IPAS and Bahasa Inggris, the teacher
// siti.aminah, and the three students from F4-3_akun-siswa-uji.csv, all enrolled.
// Run it through ../setup-4a-uji.sh, which passes TEACHER_PASSWORD.

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/user/lib.php');

$teacherpassword = getenv('TEACHER_PASSWORD');
if (!$teacherpassword) {
    cli_error('Set TEACHER_PASSWORD.');
}

// Synthetic accounts with made-up addresses: never send mail (enrolment welcomes included).
set_config('noemailever', 1);
$CFG->noemailever = true;

// Indonesian UI, so the pages say "Bank soal" and "Impor" as the F4 test cases expect.
$langs = get_string_manager()->get_list_of_translations(true);
if (!isset($langs['id'])) {
    $controller = new \tool_langimport\controller();
    $controller->install_languagepacks('id');
    get_string_manager()->reset_caches();
}
set_config('lang', 'id');
mtrace('Language: id');

// The image's installer can't take a site name with spaces.
$DB->update_record('course', (object) ['id' => SITEID, 'fullname' => 'Moodle uji Nemu', 'shortname' => 'Moodle uji']);

$course = $DB->get_record('course', ['shortname' => '4A-UJI']);
if (!$course) {
    $course = create_course((object) [
        'fullname' => 'Kelas 4A (uji)',
        'shortname' => '4A-UJI',
        'category' => \core_course_category::get_default()->id,
        'format' => 'topics',
        'numsections' => 2,
    ]);
}
foreach ([1 => 'IPAS', 2 => 'Bahasa Inggris'] as $number => $name) {
    $section = $DB->get_record('course_sections', ['course' => $course->id, 'section' => $number], '*', MUST_EXIST);
    if ($section->name !== $name) {
        course_update_section($course, $section, ['name' => $name]);
    }
}
mtrace("Course: 4A-UJI (id {$course->id}) with sections IPAS, Bahasa Inggris");

// Moodle 5 keeps questions in question-bank activities: Bank soal lists them, and Impor sits
// inside one. Create the course's default bank so the F4 guide's import has a place to go.
$bank = \core_question\local\bank\question_bank_helper::get_default_open_instance_system_type($course, true);
mtrace("Question bank: {$bank->get_formatted_name()} (cmid {$bank->id})");

$users = [[
    'username' => 'siti.aminah',
    'password' => $teacherpassword,
    'firstname' => 'Siti',
    'lastname' => 'Aminah',
    'email' => 'siti.aminah@nemu-uji.example',
    'idnumber' => '',
    'role' => 'editingteacher',
]];
$csv = array_map('str_getcsv', file(__DIR__ . '/akun-siswa-uji.csv', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
$header = array_shift($csv);
foreach ($csv as $row) {
    $student = array_combine($header, $row);
    $users[] = $student + ['role' => $student['role1']];
}

$manual = enrol_get_plugin('manual');
$instance = $DB->get_record('enrol', ['courseid' => $course->id, 'enrol' => 'manual'], '*', MUST_EXIST);
foreach ($users as $u) {
    $user = $DB->get_record('user', ['username' => $u['username'], 'deleted' => 0]);
    if (!$user) {
        $id = user_create_user((object) [
            'username' => $u['username'],
            'password' => $u['password'],
            'firstname' => $u['firstname'],
            'lastname' => $u['lastname'],
            'email' => $u['email'],
            'idnumber' => $u['idnumber'],
            'auth' => 'manual',
            'confirmed' => 1,
            'mnethostid' => $CFG->mnet_localhost_id,
            'lang' => 'id',
        ]);
        $user = $DB->get_record('user', ['id' => $id], '*', MUST_EXIST);
    }
    $role = $DB->get_record('role', ['shortname' => $u['role']], '*', MUST_EXIST);
    $manual->enrol_user($instance, $user->id, $role->id);
    mtrace("User: {$u['username']} as {$u['role']}");
}

mtrace('Done. Import the quizzes by hand: F4-1 guide sections 2-4 and F4-3_skenario.md.');
