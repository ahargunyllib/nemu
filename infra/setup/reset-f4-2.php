<?php
// Before an F4-2 run (#210): removes the quiz "Latihan IPAS Kelas 4A" that an earlier run put into
// course 4A-UJI, with its own question bank, so Nemu starts again from the course page. F4-2 needs
// nothing else prepared: course 4A-UJI with section IPAS and the teacher siti.aminah come from
// setup-4a-uji.php. Safe to run when there is nothing to remove.
// Run it locally through `pnpm --filter extension verify:f4-2` (which copies it in), or on the VPS:
//   docker compose cp setup/. moodle:/tmp/nemu-setup
//   docker compose exec -T moodle php /tmp/nemu-setup/reset-f4-2.php

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');

const F42_QUIZ = 'Latihan IPAS Kelas 4A';

\core\session\manager::set_user(get_admin());
$course = $DB->get_record('course', ['shortname' => '4A-UJI'], '*', MUST_EXIST);
$removed = 0;
foreach ($DB->get_records('quiz', ['course' => $course->id, 'name' => F42_QUIZ]) as $quiz) {
    $cm = get_coursemodule_from_instance('quiz', $quiz->id, $course->id);
    if ($cm) {
        // Its own question bank (the imported questions) goes with it.
        course_delete_module($cm->id);
        $removed++;
    }
}
// Moodle's welcome tours ("Aktifkan mode edit") count as seen for the test teacher, so none covers
// the page during the run; a real teacher sees them once.
$teacher = $DB->get_record('user', ['username' => 'siti.aminah'], '*', MUST_EXIST);
foreach ($DB->get_records('tool_usertours_tours', ['enabled' => 1]) as $tour) {
    set_user_preference('tool_usertours_tour_completion_time_' . $tour->id, time(), $teacher);
}
echo "F4-2 reset: removed {$removed} quiz(zes) named " . F42_QUIZ . "\n";
