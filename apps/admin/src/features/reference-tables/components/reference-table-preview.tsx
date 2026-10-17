import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";

const PREVIEW_ROW_COUNT = 20;

const numberFormat = new Intl.NumberFormat("id-ID");

// The first rows of a Reference Table, as the server stored them.
export default function ReferenceTablePreview({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}) {
  const previewRows = rows.slice(0, PREVIEW_ROW_COUNT);

  return (
    <Table>
      <TableCaption>
        Showing {previewRows.length} of {rows.length} rows
      </TableCaption>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {previewRows.map((row) => (
          <TableRow key={columns.map((column) => row[column]).join("|")}>
            {columns.map((column) => {
              const value = row[column];
              return (
                <TableCell key={column}>
                  {typeof value === "number" ? numberFormat.format(value) : value}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
