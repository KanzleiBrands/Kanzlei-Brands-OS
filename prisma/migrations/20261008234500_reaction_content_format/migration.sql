-- Neues Copywriting-Framework "Reaktion auf Beiträge & Kommentare" für die
-- agenturweite Format-Bibliothek (siehe src/lib/actions/content-formats.ts) -
-- per Datenmigration statt über die UI angelegt, weil diese Session keinen
-- direkten Zugriff auf die Produktions-DB hat.
INSERT INTO "ContentFormat" ("id", "name", "description", "examples", "createdAt", "updatedAt")
VALUES (
  'cd75e448e247dced5811b8009',
  'Reaktion auf Beiträge & Kommentare',
  $$Dieses Format nutzt eine echte Reaktion als Aufhänger - entweder auf einen Kommentar/eine Frage aus der eigenen Community oder auf einen aktuellen Beitrag/eine Aussage aus der Branche. Es wirkt besonders glaubwürdig, weil es zeigt, dass zugehört wird, und erzeugt neue Kommentare, weil Leser sich direkt angesprochen fühlen.

Aufbau:
1. Hook - das Zitat: Steige mit dem wörtlichen (oder leicht gekürzten) Kommentar/der Frage/Aussage ein, auf die reagiert wird. Kennzeichne es klar als Zitat, z.B. "Unter meinem letzten Beitrag kam die Frage:" oder "Ich lese gerade öfter die Aussage:". Bei Reaktion auf einen externen Beitrag/Trend: kurz einordnen, worauf reagiert wird, ohne die Quelle bloßzustellen oder namentlich anzugreifen.
2. Einordnung: 1-2 Sätze, warum diese Frage/Aussage relevant ist - vermutlich denken viele andere das Gleiche, oder sie trifft einen wichtigen, oft missverstandenen Punkt.
3. Die eigentliche Reaktion: die fachliche oder persönliche Antwort/Haltung - konkret, mit kurzer Begründung oder einem Beispiel aus der eigenen Praxis. Keine ausweichenden Allgemeinplätze, sondern eine klare Position.
4. Mehrwert über die Antwort hinaus: ein zusätzlicher Gedanke, eine Einordnung oder ein Tipp, der über die reine Beantwortung hinausgeht - das Stück soll auch für alle funktionieren, die die ursprüngliche Frage gar nicht kannten.
5. CTA: zur weiteren Diskussion einladen (z.B. "Wie seht ihr das?", "Welche Erfahrung habt ihr damit gemacht?") - idealerweise so formuliert, dass er neue Kommentare/Reaktionen provoziert, die wieder als Grundlage für den nächsten Post dieses Formats dienen können.

Tonalität: direkt, meinungsstark, nahbar - wirkt wie eine echte Antwort, nicht wie ein durchgestyltes Statement.$$,
  $$Beispiel 1 (Reaktion auf einen Kommentar):
"Unter meinem letzten Beitrag zum Thema Mandantenakquise hat jemand geschrieben: 'Das klingt alles schön, aber ohne Empfehlungen läuft in unserer Branche eh nichts.'

Ich verstehe, warum das so viele denken - jahrelang war Empfehlung der einzige Kanal, der verlässlich funktioniert hat.

Aber: Empfehlungen sind kein Gegensatz zu aktivem Marketing, sie sind das Ergebnis davon. Jeder Mandant, der über uns spricht, hat uns vorher irgendwo wahrgenommen - oft lange bevor er überhaupt ein Mandat hatte.

Der Denkfehler ist also nicht 'Empfehlung statt Marketing', sondern zu glauben, beides sei getrennt.

Wie läuft das bei euch - kommt der erste Kontakt heute eher über Empfehlung oder über das, was die Kanzlei online zeigt?"

Beispiel 2 (Reaktion auf eine Branchenaussage):
"Diese Woche las ich wieder die Aussage, Social Media sei 'nichts für seriöse Kanzleien'.

Verstehe ich - vor fünf Jahren hätte ich vermutlich ähnlich gedacht.

Nur: Mandanten und Bewerber von heute recherchieren zuerst online, bevor sie überhaupt anrufen. Wer dort nicht seriös auftritt, verliert nicht an Seriosität - er verliert nur die Chance, überhaupt gefunden zu werden.

Seriosität ist keine Frage des Kanals, sondern der Umsetzung.

Was war der Moment, an dem ihr gemerkt habt, dass sich das verändert hat?"$$,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
