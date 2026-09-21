import Link from "next/link";

export const metadata = { title: "Löschung deiner Daten | Kanzlei Brands Plattform" };

export default function DatenloeschungPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Löschung deiner Daten</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Insbesondere für Daten, die über ein Facebook- oder Instagram-Lead-Formular bei uns eingegangen sind.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Welche Daten verarbeiten wir?</h2>
        <p className="text-sm text-muted-foreground">
          Wenn du über ein Instant-Formular auf Facebook oder Instagram eine Anfrage bei einem Kunden von Kanzlei
          Brands (Ready to Rock Marketing GmbH) gestellt hast, verarbeiten wir die von dir dort angegebenen Daten
          (z. B. Name, E-Mail-Adresse, Telefonnummer und deine sonstigen Formularantworten), um deine Anfrage für
          unseren Kunden zu bearbeiten.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Wie kann ich die Löschung meiner Daten beantragen?</h2>
        <p className="text-sm text-muted-foreground">
          Schick uns eine E-Mail an{" "}
          <a href="mailto:info@kanzlei-brands.de?subject=L%C3%B6schung%20meiner%20Daten" className="underline">
            info@kanzlei-brands.de
          </a>{" "}
          mit dem Betreff &bdquo;Löschung meiner Daten&ldquo;. Gib nach Möglichkeit an, über welche Facebook-Seite
          bzw. welches Formular und mit welcher E-Mail-Adresse oder Telefonnummer du die Anfrage gestellt hast, damit
          wir deine Daten zuordnen können. Wir bestätigen den Eingang deiner Anfrage und löschen deine Daten
          innerhalb von 30 Tagen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Verbindung zu unserer App trennen</h2>
        <p className="text-sm text-muted-foreground">
          Zusätzlich kannst du in deinen Facebook- bzw. Instagram-Kontoeinstellungen unter &bdquo;Apps und
          Websites&ldquo; die Verbindung zur App &bdquo;Kanzlei Brands Lead Ads&ldquo; entfernen. Das beendet den
          Zugriff der App auf dein Konto, löscht aber nicht automatisch bereits übermittelte Formulardaten – dafür
          nutze bitte den oben beschriebenen Weg per E-Mail.
        </p>
      </section>

      <section className="flex flex-col gap-2 border-t pt-6">
        <h2 className="text-lg font-medium">Mehr zum Datenschutz</h2>
        <p className="text-sm text-muted-foreground">
          Ausführliche Informationen zur Verarbeitung deiner Daten findest du in unserer{" "}
          <Link href="https://www.kanzlei-brands.de/datenschutz" className="underline" target="_blank">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          Ready to Rock Marketing GmbH (Kanzlei Brands)
          <br />
          Mönckebergstraße 17, 20095 Hamburg
          <br />
          E-Mail: info@kanzlei-brands.de · Telefon: 040 238 359 780
          <br />
          Vollständiges Impressum:{" "}
          <Link href="https://www.kanzlei-brands.de/impressum" className="underline" target="_blank">
            kanzlei-brands.de/impressum
          </Link>
        </p>
      </section>
    </div>
  );
}
