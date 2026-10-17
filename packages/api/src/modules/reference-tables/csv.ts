// A small RFC 4180 CSV parser: quoted fields, escaped quotes ("") and CRLF line endings.
// Returns every record as an array of raw strings, header included; blank lines are skipped.
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  const endRecord = () => {
    record.push(field);
    if (record.length > 1 || record[0] !== "") records.push(record);
    record = [];
    field = "";
  };

  const input = text.startsWith("﻿") ? text.slice(1) : text;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      endRecord();
    } else {
      field += character;
    }
  }
  if (field !== "" || record.length > 0) endRecord();

  return records;
}
