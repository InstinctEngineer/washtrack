import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#2d5a87] to-[#2d8cc4] p-4 md:p-8">
      <Helmet>
        <title>Privacy Policy — WashTrack</title>
        <meta name="description" content="WashTrack privacy policy for ES&D Services Inc. employees and approved client facilities." />
        <link rel="canonical" href="https://washtracking.com/privacy" />
        <meta property="og:title" content="Privacy Policy — WashTrack" />
        <meta property="og:description" content="WashTrack privacy policy for ES&D Services Inc. employees and approved client facilities." />
        <meta property="og:url" content="https://washtracking.com/privacy" />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="Privacy Policy — WashTrack" />
        <meta name="twitter:description" content="WashTrack privacy policy for ES&D Services Inc. employees and approved client facilities." />
      </Helmet>

      <div className="mx-auto max-w-3xl">
        <Card className="shadow-2xl border-0">
          <CardHeader>
            <h1 className="text-2xl md:text-3xl font-semibold leading-none tracking-tight">
              Privacy Policy — WashTrack (ES&amp;D Services Inc.)
            </h1>
            <p className="text-sm text-muted-foreground">Last updated: July 2026</p>
          </CardHeader>
          <CardContent className="space-y-6 text-foreground/90">
            <p>
              WashTrack is operated by ES&amp;D Services Inc. ("we," "us"). WashTrack is a private, account-required business application for authorized ES&amp;D employees and approved client facilities. This policy explains what we collect and why.
            </p>

            <section>
              <h2 className="text-lg font-semibold mb-2">Information we collect</h2>
              <p>
                Account information (your name and email address); precise device location (captured only when an employee logs wash work, to confirm on-site presence); user content you create in the app (wash work logs, notes, and messages); and a user/account identifier. We may also collect basic diagnostic information needed to operate the app.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">How we use it</h2>
              <p>
                Solely to provide and operate the app: authenticating you, showing your assigned locations and history, recording wash work and its job-site location, enabling messaging between authorized users and the office, and generating the operator's internal billing and reporting. We do not use your data for advertising or tracking.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Sharing</h2>
              <p>
                We do not sell your data and do not share it with advertisers or data brokers. Data is stored with our backend provider (Supabase) and is accessible only to authorized ES&amp;D personnel and the account holder to whom it relates. We may disclose information if required by law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Location</h2>
              <p>
                Location is collected only at the moment you submit wash work, is stored with that entry, and is used only to confirm job-site presence. You can decline the location permission; the app still functions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Data retention &amp; security</h2>
              <p>
                We retain data for as long as your account is active or as needed for our business records, and protect it with industry-standard measures including encryption in transit.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Your choices</h2>
              <p>
                Accounts are provisioned and removed by the operator. To access, correct, or delete your data, contact us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Children</h2>
              <p>
                WashTrack is not directed to children and is for business use only.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Contact</h2>
              <p>
                ES&amp;D Services Inc. — instinctengineer@gmail.com
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Changes</h2>
              <p>
                We may update this policy; the "Last updated" date will reflect changes.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
