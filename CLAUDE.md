@AGENTS.md

# Automationen (Cron-Jobs, automatisierte E-Mails/Benachrichtigungen)

Vorfall 29./30.09.2026: `Organization.monthlyReportEnabled` defaultete auf
`true`, wodurch der monatliche Performance-Report an alle Kunden ging,
auch an die, deren Kampagne noch gar nicht lief (siehe
`prisma/migrations/20261007150000_monthly_report_default_off`). Damit das
nicht wieder passiert:

- Jeder neue An/Aus-Schalter für eine Automation (Cron-Versand, automatische
  E-Mail/Benachrichtigung, automatischer externer API-Call o.ä.) defaultet
  auf **AUS/inaktiv** - nie auf An. Wer es aktiv haben will, schaltet es
  bewusst ein.
- Bevor eine neue Automation zum ersten Mal scharf geschaltet wird, oder eine
  bestehende auf einen größeren/anderen Empfängerkreis ausgeweitet wird
  (z.B. neuer Cron-Job, neuer automatischer Versand, Ausweitung von "nur
  Test-Kunde" auf "alle Kunden"): **immer vorher fragen**, ob es jetzt schon
  live gehen soll oder erstmal inaktiv/nur für ausgewählte Empfänger bleiben
  soll - nicht selbst entscheiden und stillschweigend scharf schalten.
- Bei einer bestehenden Automation, deren tatsächliche Reichweite unklar ist
  (wirkt sie schon auf alle Kunden oder nur auf einen Teil?): das vor einem
  Deploy klären statt es anzunehmen.
