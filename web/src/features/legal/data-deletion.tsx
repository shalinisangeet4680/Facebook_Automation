import Link from "next/link";

import { LEGAL, type LegalSection } from "./legal-page";

export const DELETION_SUMMARY = [
  "Disconnecting a service deletes its stored sign-in straight away.",
  "Ask us to delete your account and everything in it, and it’s done within 30 days.",
  "You can also remove TreeVook’s access from your Google or Facebook settings.",
];

const mail = <a href={`mailto:${LEGAL.email}?subject=Delete%20my%20data`}>{LEGAL.email}</a>;

export const DELETION_SECTIONS: LegalSection[] = [
  {
    id: "disconnect",
    title: "Disconnect a service",
    body: (
      <>
        <p>
          In TreeVook, open the product’s connection page and choose Disconnect: Google account for
          Google Business, Connections for Play Reviews, or Setup for Meta.
        </p>
        <p>
          We delete the stored sign-in, token or key straight away and stop syncing. Data synced
          from that service, such as reviews, posts and insights, is deleted within 30 days.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Delete your whole account",
    body: (
      <>
        <p>
          Email {mail} with the subject “Delete my data”. Send it from the email on your account, or
          include the phone number you sign in with. We will:
        </p>
        <ul>
          <li>confirm the request within 48 hours and give you a reference number;</li>
          <li>
            delete your workspace, connections, content and personal data within 30 days, and clear
            backups within a further 30 days;
          </li>
          <li>email you when the deletion is complete.</li>
        </ul>
        <p>
          We keep only what the law requires, such as tax records once paid plans exist, and
          security logs for up to 12 months.
        </p>
      </>
    ),
  },
  {
    id: "facebook",
    title: "Facebook and Instagram",
    body: (
      <>
        <p>To remove TreeVook from Facebook:</p>
        <ul>
          <li>
            Go to Facebook Settings &amp; privacy → Settings → Business integrations, or Apps and
            websites.
          </li>
          <li>Find TreeVook AI and choose Remove.</li>
          <li>
            Then email {mail} to have the data we already synced from Facebook and Instagram
            deleted, as described above.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "google",
    title: "Google",
    body: (
      <p>
        Open <a href="https://myaccount.google.com/permissions">your Google Account permissions</a>,
        choose TreeVook AI and remove access. To delete the data we already synced, disconnect the
        account in TreeVook or email us.
      </p>
    ),
  },
  {
    id: "more",
    title: "More information",
    body: (
      <p>
        Our <Link href="/privacy">Privacy Policy</Link> explains what we collect and how long we
        keep it.
      </p>
    ),
  },
];
