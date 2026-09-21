import Link from "next/link";

export const metadata = { title: "Nutzungsbedingungen | Kanzlei Brands Plattform" };

export default function NutzungsbedingungenPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Nutzungsbedingungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Für die Plattform unter app.kanzlei-brands.de. Stand: September 2026.</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">1. Geltungsbereich</h2>
        <p className="text-sm text-muted-foreground">
          Diese Nutzungsbedingungen regeln die Nutzung der Online-Plattform unter app.kanzlei-brands.de
          (&bdquo;Plattform&ldquo;), die von der Ready to Rock Marketing GmbH unter der Marke &bdquo;Kanzlei
          Brands&ldquo; (&bdquo;wir&ldquo;) betrieben wird, durch Kunden von Kanzlei Brands und deren Mitarbeiter:innen
          (&bdquo;Nutzer&ldquo;). Mit dem Login oder der sonstigen Nutzung der Plattform erkennen Nutzer diese
          Bedingungen an.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">2. Leistungsbeschreibung</h2>
        <p className="text-sm text-muted-foreground">
          Die Plattform ist eine Software, die Kunden von Kanzlei Brands im Rahmen des mit ihnen bestehenden
          Vertragsverhältnisses zur Verwaltung von Leads, Bewerbungen und Marketing-Kampagnen zur Verfügung gestellt
          wird. Der Funktionsumfang kann im Zuge der Weiterentwicklung angepasst, erweitert oder verändert werden.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">3. Zugang und Nutzerkonten</h2>
        <p className="text-sm text-muted-foreground">
          Der Zugang wird ausschließlich Kunden von Kanzlei Brands sowie deren berechtigten Mitarbeiter:innen im
          Rahmen des jeweiligen Vertragsverhältnisses eingerichtet. Zugangsdaten sind vertraulich zu behandeln und
          dürfen nicht an Dritte weitergegeben werden. Für Aktivitäten unter dem eigenen Zugang ist der jeweilige
          Nutzer verantwortlich und hat einen Missbrauchsverdacht unverzüglich zu melden.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">4. Pflichten der Nutzer</h2>
        <p className="text-sm text-muted-foreground">
          Nutzer verpflichten sich, die Plattform nur im Rahmen des vereinbarten Zwecks und in Übereinstimmung mit
          geltendem Recht zu nutzen. Dazu gehört insbesondere die Einhaltung der datenschutzrechtlichen Vorgaben bei
          der Verarbeitung von Bewerber- und Leaddaten, die über die Plattform verwaltet werden.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">5. Verfügbarkeit und Änderungen</h2>
        <p className="text-sm text-muted-foreground">
          Wir sind bemüht, die Plattform möglichst durchgehend verfügbar zu halten, können jedoch keine
          ununterbrochene Verfügbarkeit garantieren. Wartungsarbeiten, Weiterentwicklungen oder technische Störungen
          können zu vorübergehenden Einschränkungen führen.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">6. Haftung</h2>
        <p className="text-sm text-muted-foreground">
          Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie nach den Vorschriften des
          Produkthaftungsgesetzes. Für leichte Fahrlässigkeit haften wir nur bei der Verletzung wesentlicher
          Vertragspflichten (Kardinalpflichten) und in diesem Fall begrenzt auf den vertragstypisch vorhersehbaren
          Schaden. Im Übrigen ist die Haftung ausgeschlossen.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">7. Datenschutz</h2>
        <p className="text-sm text-muted-foreground">
          Informationen zur Verarbeitung personenbezogener Daten findest du in unserer{" "}
          <Link href="https://www.kanzlei-brands.de/datenschutz" className="underline" target="_blank">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">8. Laufzeit und Beendigung</h2>
        <p className="text-sm text-muted-foreground">
          Der Zugang zur Plattform besteht für die Dauer des zugrunde liegenden Vertragsverhältnisses mit Kanzlei
          Brands. Mit Beendigung dieses Vertragsverhältnisses wird der Zugang gesperrt.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">9. Änderungen dieser Nutzungsbedingungen</h2>
        <p className="text-sm text-muted-foreground">
          Wir können diese Nutzungsbedingungen mit Wirkung für die Zukunft anpassen, etwa bei Weiterentwicklung der
          Plattform oder Änderungen der Rechtslage. Über wesentliche Änderungen informieren wir rechtzeitig.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">10. Schlussbestimmungen</h2>
        <p className="text-sm text-muted-foreground">
          Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, Hamburg.
        </p>
      </section>

      <section className="flex flex-col gap-2 border-t pt-6">
        <h2 className="text-lg font-medium">Kontakt</h2>
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
