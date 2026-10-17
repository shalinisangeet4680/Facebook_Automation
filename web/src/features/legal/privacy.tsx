import Link from "next/link";

import { LEGAL, type LegalSection } from "./legal-page";

export const PRIVACY_SUMMARY = [
  "We use your data only to run the automations you set up.",
  "We never sell your data, and we never use Google or Meta data for advertising.",
  "Sign-ins and keys are encrypted. You can disconnect or delete everything at any time.",
];

const mail = <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          TreeVook AI is run by {LEGAL.company} (“TreeVook”, “we”, “us”), India, at treevook.com and
          its subdomains (such as googlebusiness.treevook.com and playreview.treevook.com). This
          policy explains what we collect, why, and the choices you have.
        </p>
        <p>
          Questions or requests: {mail}. Registered office: {LEGAL.address}.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <h3>Your account</h3>
        <ul>
          <li>
            Your Google account’s name, email address and profile photo, used to sign you in with
            Google.
          </li>
          <li>Your workspace name and role.</li>
        </ul>
        <h3>Services you connect</h3>
        <p>We only collect data from services you choose to connect.</p>
        <ul>
          <li>
            <strong>Google Business Profile:</strong> your Google account email; your business
            accounts and locations; business information (name, address, phone, website, hours,
            categories, description); reviews, including reviewers’ public names and photos;
            replies; posts; and profile performance (views, calls, website clicks, direction
            requests, messages, bookings).
          </li>
          <li>
            <strong>Google Play:</strong> the service account key you upload; your apps and their
            listing details; reviews and replies; and report files from your Play Console reports
            bucket.
          </li>
          <li>
            <strong>Meta (Facebook and Instagram):</strong> the access you grant; your business, ad
            account, Facebook Page, Instagram account and dataset; campaigns, ads and their
            performance; and posts with engagement counts.
          </li>
          <li>
            <strong>Slack:</strong> a webhook address, if you turn on alerts.
          </li>
          <li>
            <strong>Anthropic:</strong> your own API key, if you choose to use it instead of ours.
          </li>
        </ul>
        <h3>What you create</h3>
        <p>
          Reply templates, rules, drafts, posts, campaign plans, and images or videos you upload or
          ask Claude to make.
        </p>
        <h3>Claude connector</h3>
        <p>
          If you connect TreeVook to Claude, we issue access tokens for that connection and record
          which tools were used.
        </p>
        <h3>Technical data</h3>
        <p>
          IP address, browser or device type, sign-in sessions, error logs, and an activity log of
          actions in your workspace (who did what, and when).
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use it",
    body: (
      <>
        <ul>
          <li>
            To provide the features you turn on: syncing reviews and results, drafting replies and
            posts, posting what you approve or what your rules allow, analytics, and alerts.
          </li>
          <li>To keep accounts secure and prevent abuse.</li>
          <li>To answer support requests.</li>
          <li>To meet legal obligations.</li>
        </ul>
        <p>
          We do not sell your data, use it for advertising, or build profiles of you or your
          customers. AI drafts content, and your own rules (Auto, Approval or Manual) decide what is
          posted.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <p>
        To draft replies, posts and plans, we send the relevant text to Anthropic’s Claude models:
        review or comment text, business details and your instructions. Anthropic processes this
        under its commercial terms and does not use it to train its models. If you add your own
        Anthropic API key, those requests run on your Anthropic account.
      </p>
    ),
  },
  {
    id: "google",
    title: "Google user data",
    body: (
      <>
        <p>
          When you connect a Google account, TreeVook asks for permission to manage your Business
          Profile (the <code>business.manage</code> scope). We use it only to show and manage the
          profiles you connect, as you direct: replying to reviews, publishing posts, editing
          business information and reading performance insights.
        </p>
        <blockquote>
          TreeVook’s use and transfer of information received from Google APIs to any other app will
          adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </blockquote>
        <ul>
          <li>
            We transfer Google user data only to provide or improve these features, for security, to
            comply with the law, or as part of a merger or acquisition with notice to you.
          </li>
          <li>We never use it for advertising, and we never sell it.</li>
          <li>We never use it to train general-purpose AI models.</li>
          <li>
            People at TreeVook do not read it unless you ask us to, it is needed for security, or
            the law requires it.
          </li>
        </ul>
        <p>
          You can remove TreeVook’s access at any time from{" "}
          <a href="https://myaccount.google.com/permissions">your Google Account permissions</a>.
        </p>
      </>
    ),
  },
  {
    id: "meta",
    title: "Meta platform data",
    body: (
      <p>
        We use data from Facebook and Instagram only to provide the features you turn on, and we
        follow Meta’s Platform Terms. To delete your data, follow the steps on our{" "}
        <Link href="/data-deletion">data deletion page</Link>.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <ul>
        <li>
          <strong>Service providers</strong> who help us run TreeVook: cloud hosting and database,
          Anthropic (AI drafting), our SMS provider (sign-in codes), and Slack if you turn on
          alerts. They may use the data only to provide their service to us.
        </li>
        <li>
          <strong>Google and Meta</strong>, to carry out the actions you request, such as posting a
          reply.
        </li>
        <li>
          <strong>Members of your workspace</strong>, who can see the workspace’s connected data.
        </li>
        <li>
          <strong>Authorities</strong>, when the law requires it.
        </li>
        <li>
          <strong>A buyer or successor</strong>, if TreeVook is merged or sold. We will tell you
          first.
        </li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Data travels over HTTPS. Access tokens, service account keys and API keys are encrypted with
        AES-256-GCM before they are stored. Sign-in uses secure, HTTP-only cookies. Only people who
        need it to run the service can access production data, and important actions are recorded in
        an activity log.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>We keep your data while your account is active.</li>
        <li>
          When you disconnect a service, we delete its stored sign-in or key straight away and stop
          syncing.
        </li>
        <li>
          When you remove a location, an app or your workspace, we delete its data within 30 days.
          Backups are cleared within a further 30 days.
        </li>
        <li>
          We keep security and activity logs for up to 12 months, unless the law requires longer.
        </li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>
          You can ask to see, correct or delete your personal data, withdraw consent by
          disconnecting a service, or nominate someone to act for you, as allowed under India’s
          Digital Personal Data Protection Act, 2023.
        </p>
        <p>Email {mail} from the email or phone number on your account. We reply within 30 days.</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We use only essential cookies to keep you signed in, and your browser’s storage to remember
        your light or dark theme. We do not use advertising or tracking cookies.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>TreeVook is for businesses and is not meant for anyone under 18.</p>,
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        If we change this policy in a way that matters, we will tell you by email or in the app
        before the change takes effect. The date at the top shows the latest version.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact and grievances",
    body: (
      <p>
        Grievance Officer: {LEGAL.grievanceOfficer}, {LEGAL.company}, {LEGAL.address}. Email {mail}.
        We acknowledge complaints within 48 hours and resolve them within 30 days.
      </p>
    ),
  },
];
