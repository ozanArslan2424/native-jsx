export type Edit = { start: number; end: number; text: string };

export function applyEdits(code: string, edits: Array<Edit>): string {
	let output = code;
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
	}
	return output;
}
