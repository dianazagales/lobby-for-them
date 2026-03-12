export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy mb-6">About Lobby for Them</h1>

      <div className="prose max-w-none space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-navy mb-3">Our Mission</h2>
          <p>
            Animals can't call their representatives. They can't write emails, sign petitions, or show up to town halls.
            But you can — and your voice matters more than you might think.
          </p>
          <p className="mt-3">
            Lobby for Them exists to remove every barrier between you and your elected officials. We track active
            animal welfare legislation, write the emails, find your representatives, and put everything in one place.
            All you have to do is click send.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-navy mb-3">How It Works</h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-600">
            <li><strong>We track active bills.</strong> Our team monitors federal and state animal welfare legislation and curates the bills where constituent contact makes the most impact.</li>
            <li><strong>You enter your zip code.</strong> We use the Google Civic Information API to find your exact federal and state representatives.</li>
            <li><strong>We write the email.</strong> You get a pre-filled, personalized email template — warm, direct, and written like a real constituent letter, not a form petition.</li>
            <li><strong>You send it.</strong> One click opens your email client, pre-addressed and pre-filled. Edit it if you want — then hit send.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-bold text-navy mb-3">Data Sources</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li><strong>LegiScan:</strong> Live legislative data including bill status, sponsors, and full text.</li>
            <li><strong>Google Civic Information API:</strong> Representative lookup by zip code.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-navy mb-3">Disclaimer</h2>
          <p className="text-gray-500 text-sm">
            Lobby for Them is an advocacy tool only. We do not provide legal advice. Bill information is provided for
            informational and advocacy purposes. Always verify current bill status through official government sources.
          </p>
        </section>

        <section className="bg-warm-white rounded-xl p-6 border border-gray-100">
          <h2 className="text-lg font-bold text-navy mb-2">Looking to report an active cruelty case?</h2>
          <p className="text-gray-600 text-sm">
            That site is coming soon. We're building a companion resource focused on reporting animal cruelty to the
            right authorities. Stay tuned.
          </p>
        </section>
      </div>
    </div>
  );
}
