import {
  PlayApiError,
  PlayCredentials,
} from "@modules/play/domain/ports/play-api";

import {
  ErrorIssueData,
  ErrorReportData,
  IssueType,
  PlayReleasesApi,
  TrackData,
  VitalsRow,
} from "../domain/ports/releases-api";

const DAY = 86_400_000;

const seedTracks = (): TrackData[] => [
  {
    track: "production",
    releases: [
      {
        name: "2.3.1",
        versionCodes: ["231"],
        status: "completed",
        userFraction: null,
        releaseNotes: [
          { language: "en-US", text: "Faster order tracking and bug fixes." },
        ],
      },
      {
        name: "2.4.0",
        versionCodes: ["240"],
        status: "inProgress",
        userFraction: 0.1,
        releaseNotes: [
          { language: "en-US", text: "New checkout and saved addresses." },
        ],
      },
    ],
  },
  {
    track: "beta",
    releases: [
      {
        name: "2.5.0",
        versionCodes: ["250"],
        status: "completed",
        userFraction: null,
        releaseNotes: [],
      },
    ],
  },
  { track: "alpha", releases: [] },
  {
    track: "internal",
    releases: [
      {
        name: "2.5.1",
        versionCodes: ["251"],
        status: "completed",
        userFraction: null,
        releaseNotes: [],
      },
    ],
  },
];

const tracks = new Map<string, TrackData[]>();
export const mockReleaseCommits: { packageName: string; track: TrackData }[] =
  [];

export function resetMockReleases(): void {
  tracks.clear();
  mockReleaseCommits.length = 0;
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function appTracks(packageName: string) {
  let list = tracks.get(packageName);
  if (!list) {
    list = seedTracks();
    tracks.set(packageName, list);
  }
  return list;
}

const dayAgo = (n: number) =>
  new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

const wobble = (seed: number) => ((seed * 7919) % 11) / 10 - 0.5;

function series(
  code: string,
  from: number,
  to: number,
  users: number,
  rate: number,
): VitalsRow[] {
  const rows: VitalsRow[] = [];
  for (let d = from; d >= to; d--)
    rows.push({
      day: dayAgo(d),
      versionCode: code,
      rate: Math.round(rate * (1 + wobble(d + Number(code)) * 0.2) * 1e6) / 1e6,
      users: Math.round(users * (1 + wobble(d) * 0.1)),
    });
  return rows;
}

function issuesFor(pkg: string) {
  return [
    {
      id: "c1001",
      type: "CRASH" as IssueType,
      cause: "java.lang.NullPointerException",
      location: `${pkg}.orders.OrdersAdapter.onBindViewHolder`,
      reports: 412,
      users: 268,
      firstVersionCode: "240",
      lastVersionCode: "240",
      trace: `java.lang.NullPointerException: Attempt to invoke virtual method 'java.lang.String ${pkg}.orders.Order.getStatus()' on a null object reference
\tat ${pkg}.orders.OrdersAdapter.onBindViewHolder(OrdersAdapter.kt:87)
\tat ${pkg}.orders.OrdersAdapter.onBindViewHolder(OrdersAdapter.kt:31)
\tat androidx.recyclerview.widget.RecyclerView$Adapter.bindViewHolder(RecyclerView.java:7254)
\tat ${pkg}.orders.OrdersFragment$render$1.invoke(OrdersFragment.kt:142)
\tat android.os.Handler.handleCallback(Handler.java:958)`,
    },
    {
      id: "a2002",
      type: "ANR" as IssueType,
      cause: "Input dispatching timed out",
      location: `${pkg}.settings.Prefs.load`,
      reports: 96,
      users: 81,
      firstVersionCode: "229",
      lastVersionCode: "240",
      trace: `"main" tid=1 Blocked
\tat java.io.FileInputStream.read(FileInputStream.java:280)
\tat android.app.SharedPreferencesImpl.awaitLoadedLocked(SharedPreferencesImpl.java:256)
\tat ${pkg}.settings.Prefs.load(Prefs.kt:22)
\tat ${pkg}.MainActivity.onCreate(MainActivity.kt:48)
\tat android.app.Activity.performCreate(Activity.java:8595)`,
    },
    {
      id: "c3003",
      type: "CRASH" as IssueType,
      cause: "java.lang.IllegalStateException",
      location: `${pkg}.checkout.CheckoutFragment.onPaymentResult`,
      reports: 57,
      users: 49,
      firstVersionCode: "240",
      lastVersionCode: "240",
      trace: `java.lang.IllegalStateException: Fragment CheckoutFragment not attached to a context.
\tat androidx.fragment.app.Fragment.requireContext(Fragment.java:972)
\tat ${pkg}.checkout.CheckoutFragment.onPaymentResult(CheckoutFragment.kt:203)
\tat ${pkg}.checkout.PaymentLauncher$launch$1.onResult(PaymentLauncher.kt:61)
\tat android.os.Handler.dispatchMessage(Handler.java:106)`,
    },
    {
      id: "c4004",
      type: "CRASH" as IssueType,
      cause: "java.lang.OutOfMemoryError",
      location: `${pkg}.media.ImageLoader.decode`,
      reports: 23,
      users: 19,
      firstVersionCode: "231",
      lastVersionCode: "240",
      trace: `java.lang.OutOfMemoryError: Failed to allocate a 48211212 byte allocation with 25165824 free bytes
\tat android.graphics.BitmapFactory.decodeStream(BitmapFactory.java:790)
\tat ${pkg}.media.ImageLoader.decode(ImageLoader.kt:54)
\tat ${pkg}.media.ImageLoader.load(ImageLoader.kt:30)`,
    },
  ];
}

const DEVICES = [
  ["Samsung Galaxy A05", 34],
  ["Redmi Note 12", 33],
  ["Vivo Y21", 31],
] as const;

export class MockPlayReleasesApi implements PlayReleasesApi {
  private check(key: PlayCredentials, packageName: string) {
    if (
      key.clientEmail.startsWith("noaccess") ||
      packageName.endsWith(".denied")
    )
      throw new PlayApiError(
        "access",
        `${key.clientEmail} can't manage releases for ${packageName}. In Play Console → Users and permissions, give it "Release to production, exclude devices, and use Play App Signing" and "Release apps to testing tracks" for this app.`,
      );
  }

  private checkVitals(key: PlayCredentials, packageName: string) {
    this.check(key, packageName);
    if (key.clientEmail.startsWith("novitals"))
      throw new PlayApiError(
        "access",
        `${key.clientEmail} can't read vitals for ${packageName}. In Play Console → Users and permissions, give it "View app quality information" for this app.`,
      );
  }

  async listTracks(key: PlayCredentials, packageName: string) {
    this.check(key, packageName);
    return copy(appTracks(packageName));
  }

  async listingLanguages(key: PlayCredentials, packageName: string) {
    this.check(key, packageName);
    return ["en-US", "hi-IN", "es-419", "pt-BR"];
  }

  async updateTrack(
    key: PlayCredentials,
    packageName: string,
    track: TrackData,
  ) {
    this.check(key, packageName);
    const list = appTracks(packageName);
    const live = new Set(
      list.flatMap((t) => t.releases.flatMap((r) => r.versionCodes)),
    );
    for (const r of track.releases)
      for (const code of r.versionCodes)
        if (!live.has(code))
          throw new PlayApiError(
            "invalid",
            `APK or bundle with version code ${code} was not uploaded.`,
          );
    const stagedCount = track.releases.filter(
      (r) => r.status === "inProgress" || r.status === "halted",
    ).length;
    if (stagedCount > 1)
      throw new PlayApiError(
        "invalid",
        "A track can have only one staged rollout.",
      );
    const saved = copy(track);
    const i = list.findIndex((t) => t.track === track.track);
    if (i < 0) list.push(saved);
    else list[i] = saved;
    mockReleaseCommits.push({ packageName, track: copy(saved) });
    return copy(saved);
  }

  async vitals(
    key: PlayCredentials,
    packageName: string,
    metric: "crash" | "anr",
    days: number,
  ): Promise<VitalsRow[]> {
    this.checkVitals(key, packageName);
    const healthy = packageName.endsWith(".steady");
    const rows =
      metric === "crash"
        ? [
            ...series("229", 28, 15, 3000, 0.0071),
            ...series("231", 20, 1, 4200, 0.0062),
            ...series("240", 3, 1, 900, healthy ? 0.0058 : 0.0231),
          ]
        : [
            ...series("229", 28, 15, 3000, 0.0026),
            ...series("231", 20, 1, 4200, 0.0021),
            ...series("240", 3, 1, 900, healthy ? 0.0019 : 0.0034),
          ];
    const since = dayAgo(days);
    return rows.filter((r) => r.day >= since);
  }

  async errorIssues(
    key: PlayCredentials,
    packageName: string,
    type: IssueType | null,
  ): Promise<ErrorIssueData[]> {
    this.checkVitals(key, packageName);
    return issuesFor(packageName)
      .filter((i) => !type || i.type === type)
      .map(({ trace: _trace, ...i }) => ({
        ...i,
        issueUri: `https://play.google.com/console/developers/app/vitals/crashes/${i.id}/details`,
      }));
  }

  async errorReports(
    key: PlayCredentials,
    packageName: string,
    issueId: string,
  ): Promise<ErrorReportData[]> {
    this.checkVitals(key, packageName);
    const issue = issuesFor(packageName).find((i) => i.id === issueId);
    if (!issue)
      throw new PlayApiError("not_found", "This crash cluster wasn't found.");
    return DEVICES.map(([device, api], n) => ({
      id: `${issue.id}-r${n + 1}`,
      type: issue.type,
      reportText: issue.trace,
      eventTime: new Date(Date.now() - (n + 1) * 3_600_000).toISOString(),
      device,
      androidVersion: api,
      versionCode: issue.lastVersionCode,
    }));
  }
}
