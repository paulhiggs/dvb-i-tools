/**
 * revisions.mts
 *
 *  DVB-I-tools
 *  Copyright (c) 2021-2026, Paul Higgs
 *  BSD-2-Clause license, see LICENSE.txt file
 *
 * The revision levels of the specifications a document is validated against (issue #125): A177 (service lists, service list
 * registries and playlists) and TV-Anytime as profiled by A177 (content guide documents). They are distinct types, so a
 * revision of one can not be compared with a revision of the other, or with a bare number:
 *
 *   cgVersion < cgVersions.r3 || slVersion < slVersions.r7    compiles, and compares the levels
 *   cgVersion < slVersions.r7                                 does not compile (TS2365)
 *   cgVersion == slVersions.r7                                does not compile (TS2367)
 *   slVersion < 7, slVersion + 1                              do not compile (TS2365)
 *
 * Revisions are only compared: the validator has no need to step from one revision to another. JavaScript has no operator
 * overloading. What each of the operators that C++ can overload means for a revision:
 *   < <= > >=     compare the levels, through [Symbol.toPrimitive]. TypeScript only allows them between revisions of the same
 *                 specification
 *   == !=         the same revision. JavaScript compares objects by identity, and each revision is a single object (the
 *                 constructors are private, and each class makes its revisions once), so the same object means the same level.
 *                 switch / case works for the same reason
 *   + - * / % & | ^ << >>   have no meaning for a revision, and do not compile (TS2365, TS2362)
 *   unary - and ~ have no meaning for a revision, but TypeScript can not reject them for an object: do not use them
 *   ! && ||       every object is true, so these can not tell anything about a revision: use known
 */

// the custom formatting of an object by util.inspect() (console.log), without importing node:util
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/**
 * a revision of a specification: its level (0 for the first, -1 when not known) and how it is named. Each specification is
 * a class derived from this one, which makes its own revisions, from r0 up to its latest: no other revision can be made
 */
abstract class Revision {
	readonly level: number;
	readonly label: string;

	protected constructor(level: number, label: string) {
		this.level = level;
		this.label = label;
	}

	// the revision used when it is not known
	protected abstract notKnown(): this;

	/**
	 * the operators <, <=, > and >= compare the levels. In a string (a template literal, or an error code such as CG003:3) a
	 * revision is its level
	 */
	[Symbol.toPrimitive](hint: string): number | string {
		return hint == "string" ? String(this.level) : this.level;
	}

	toString(): string {
		return String(this.level);
	}

	toJSON(): number {
		return this.level;
	}

	[INSPECT](): string {
		return this.label;
	}

	/**
	 * whether the revision is known: false for the revision of a document whose namespace is not recognised. (!revision is
	 * always false, as every object is true)
	 */
	get known(): boolean {
		return this != this.notKnown();
	}
}

/**
 * a revision of TV-Anytime as profiled by DVB A177, used by content guide documents
 */
export class TVARevision extends Revision {
	#specification = "TV-Anytime";

	private constructor(level: number) {
		super(level, level < 0 ? "TV-Anytime (unknown revision)" : `TV-Anytime r${level}`);
	}

	get specification(): string {
		return this.#specification;
	}

	static readonly r0 = new TVARevision(0); // TV-Anytime 2019
	static readonly r1 = new TVARevision(1); // TV-Anytime 2023
	static readonly r2 = new TVARevision(2); // TV-Anytime 2024 - ETSI TS 102 822-3-1 v1.13.1
	static readonly r3 = new TVARevision(3); // TV-Anytime 2027 - ETSI TS 102 822-3-1 v1.15.1 (urn:tva:metadata:2027, which replaces the unpublished v1.14.1 urn:tva:metadata:2026)
	static readonly unknown = new TVARevision(-1);
	static readonly latest = TVARevision.r3; // the highest revision: there is none after it
	static readonly all: readonly TVARevision[] = [TVARevision.r0, TVARevision.r1, TVARevision.r2, TVARevision.r3];

	protected notKnown(): this {
		return TVARevision.unknown as this;
	}
}

/**
 * a revision of DVB A177, used by service lists, service list registries and playlists. Each records the revision of
 * TV-Anytime that its service list schema imports, which the TV-Anytime elements of a service list (such as
 * <AccessibilityAttributes>) are validated against (issue #128)
 */
export class A177Revision extends Revision {
	#specification = "A177"; // makes the type nominal: an A177Revision is not a TVARevision, although they have the same shape

	// the TV-Anytime revision imported by the service list schema of this revision
	readonly tvAnytime: TVARevision;

	private constructor(level: number, tvAnytime: TVARevision) {
		super(level, level < 0 ? "A177 (unknown revision)" : level == 0 ? "A177" : `A177r${level}`);
		this.tvAnytime = tvAnytime;
	}

	get specification(): string {
		return this.#specification;
	}

	static readonly r0 = new A177Revision(0, TVARevision.r0); // A177 - TV-Anytime 2019
	static readonly r1 = new A177Revision(1, TVARevision.r0); // A177r1 - TV-Anytime 2019
	static readonly r2 = new A177Revision(2, TVARevision.r0); // A177r2 - TV-Anytime 2019
	static readonly r3 = new A177Revision(3, TVARevision.r0); // A177r3 - TV-Anytime 2019
	static readonly r4 = new A177Revision(4, TVARevision.r0); // A177r4 - ETSI TS 103 770 v1.0.1 (2022-12) - TV-Anytime 2019
	static readonly r5 = new A177Revision(5, TVARevision.r1); // A177r5 - TV-Anytime 2023
	static readonly r6 = new A177Revision(6, TVARevision.r2); // A177r6 - ETSI TS 103 770 v1.2.1 (2024-06) - TV-Anytime 2024
	static readonly r7 = new A177Revision(7, TVARevision.r2); // A177r7 - TV-Anytime 2024
	static readonly r8 = new A177Revision(8, TVARevision.r3); // A177r8 - draft ETSI TS 103 770 v1.3.1 (2026-06) (and second edition being drafted) - TV-Anytime 2027
	static readonly unknown = new A177Revision(-1, TVARevision.unknown);
	static readonly latest = A177Revision.r8; // the highest revision: there is none after it
	static readonly all: readonly A177Revision[] = [A177Revision.r0, A177Revision.r1, A177Revision.r2, A177Revision.r3, A177Revision.r4, A177Revision.r5, A177Revision.r6, A177Revision.r7, A177Revision.r8];

	protected notKnown(): this {
		return A177Revision.unknown as this;
	}
}
