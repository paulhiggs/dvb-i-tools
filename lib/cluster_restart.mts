/**
 * cluster_restart.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * Replace cluster workers that exit, without a tight restart loop when they keep failing (e.g. at startup)
 */

import cluster from "cluster"
import chalk from "chalk"

const EARLY_EXIT_MS = 60 * 1000, // a worker that exits within this time of being started counts as a failed start
	MAX_FAILED_STARTS = 10, // stop restarting after this many consecutive failed starts
	FIRST_DELAY_MS = 1000,
	MAX_DELAY_MS = 30 * 1000;

/**
 * Fork a replacement each time a worker exits.
 * A worker that ran for at least EARLY_EXIT_MS is replaced straight away. Workers that exit sooner are failed starts:
 * each consecutive failed start delays the next fork (1s, 2s, 4s ... up to 30s), and after MAX_FAILED_STARTS no
 * further workers are started. If none are still running, the primary then exits with code 1.
 * Must be called in the primary process, after the initial workers have been forked.
 */
export function restartWorkersOnExit(): void {
	const startedAt = new Map<number, number>(); // worker id -> time forked
	let failedStarts = 0;

	const fork = () => {
		const worker = cluster.fork();
		startedAt.set(worker.id, Date.now());
	};
	Object.values(cluster.workers ?? {}).forEach((w) => {
		if (w) startedAt.set(w.id, Date.now());
	});

	cluster.on("exit", (worker, code, signal) => {
		const ranFor = Date.now() - (startedAt.get(worker.id) ?? 0);
		startedAt.delete(worker.id);
		const reason = signal ? `signal ${signal}` : `exit code ${code}`;

		if (ranFor >= EARLY_EXIT_MS) {
			failedStarts = 0;
			console.log(chalk.red(`worker ${worker.process.pid} died (${reason}) - starting another`));
			fork();
			return;
		}

		failedStarts++;
		if (failedStarts > MAX_FAILED_STARTS) {
			console.log(chalk.red(`worker ${worker.process.pid} died (${reason}) - ${failedStarts - 1} consecutive workers failed to start, not restarting`));
			const running = Object.values(cluster.workers ?? {}).filter((w) => w && !w.isDead()).length;
			if (running == 0) {
				console.log(chalk.red("no workers are running - exiting"));
				process.exit(1);
			}
			return;
		}
		const delay = Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** (failedStarts - 1));
		console.log(chalk.red(`worker ${worker.process.pid} died after ${Math.round(ranFor / 1000)}s (${reason}) - starting another in ${delay / 1000}s`));
		setTimeout(fork, delay);
	});
}
