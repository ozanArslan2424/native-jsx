export type Migration = {
	flag: `--${string}`;
	description: string;
	/** Returns an exit code: 0 on success, 1 if anything failed or was skipped. */
	run(cwd: string): number;
};
