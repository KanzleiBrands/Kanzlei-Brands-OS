-- KI-Ideen-Generierung fürs Social Media Content Board (siehe
-- src/lib/actions/content-ideas.ts): ContentFormat ist eine agentur-weite
-- Bibliothek wiederverwendbarer Format-Vorlagen (Beschreibung + Beispielposts
-- fürs Few-Shot-Prompting), SocialPost.title/topic entstehen in Phase 1
-- (Ideen generieren), caption wird erst in Phase 2 ("Text mit KI erstellen")
-- befüllt. Organization.contentBrandDna ist die einmalig erfasste Marken-DNA
-- je Kunde, die als Kontext in jede Generierung einfließt.

CREATE TABLE "ContentFormat" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "examples"    TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentFormat_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SocialPost"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "topic" TEXT,
  ADD COLUMN "contentFormatId" TEXT;

ALTER TABLE "SocialPost"
  ADD CONSTRAINT "SocialPost_contentFormatId_fkey"
  FOREIGN KEY ("contentFormatId") REFERENCES "ContentFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Organization" ADD COLUMN "contentBrandDna" TEXT;

-- Seed: eine Start-Bibliothek nachweislich gut performender Social-Media-
-- Copywriting-Formate (nicht nur die 3 aus dem "Stefan Müller"-Referenzcase -
-- Storytelling/PAS/Rage & Real Talk - sondern ergänzt um Education,
-- Pattern-Interrupt/kontroverse These, Behind-the-Scenes, Vorher-Nachher und
-- Mythos-vs-Realität), jede mit starkem Hook-Muster + einem Beispielpost
-- fürs Few-Shot-Prompting. Dient als sofort nutzbarer Startpunkt, kein
-- Pflichtbestand - über "Formate verwalten" jederzeit änderbar.
INSERT INTO "ContentFormat" ("id", "name", "description", "examples", "createdAt", "updatedAt")
VALUES
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '1'), 1, 20),
  'Storytelling',
  $desc$1. Hook (Frage- oder Cliffhanger-Format):
- Weckt in maximal 8-12 Wörtern Neugier, ohne die Pointe zu verraten.
- Muss den Leser zwingen, auf "Mehr anzeigen" zu klicken.
- Beispiel: "Was passiert, wenn plötzlich alles anders läuft als geplant?"
2. Szene: eine konkrete, persönlich erlebte Situation schildern - Ort, Zeitpunkt, Gefühl. Keine Verallgemeinerungen, sondern ein einzelner Moment.
3. Wendepunkt: der Moment, an dem sich etwas ändert oder eine Erkenntnis einsetzt.
4. Lektion: die übertragbare Erkenntnis, die zum Thema/Angebot zurückführt - ohne platten Verkaufs-Schluss.
Stilmittel: kurze Absätze (1-3 Sätze), viel Weißraum, einfache Wörter, keine Fachbegriffe ohne Erklärung.$desc$,
  $ex$### Beispiel:
Vor zwei Jahren hätte ich diesen Beitrag nicht schreiben können.

Ich saß in einem Meeting, in dem ein Mandant uns fast verloren hätte - wegen eines Fehlers, der nie hätte passieren dürfen.

Keine Ausrede, keine Zeit zu verlieren. Nur die Frage: Wie stellen wir das jetzt wieder gerade?

Wir haben an diesem Abend nicht das Problem gelöst. Wir haben verstanden, warum es überhaupt entstehen konnte.

Seitdem läuft bei uns kein Mandat mehr ohne einen zweiten Blick von jemandem, der nicht selbst daran gearbeitet hat.

Der Fehler hat uns mehr gelehrt als jeder Erfolg davor.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '2'), 1, 20),
  'PAS (Problem-Agitate-Solution)',
  $desc$Problem, Agitate, Solution - dreiteiliger Aufbau:
1. Headline/Hook (Frage-Format): stellt direkt und konkret das Problem der Zielgruppe in den Raum.
   Beispiel: "Warum scheitern so viele Projekte genau an diesem Punkt?"
2. Agitate: das Problem zuspitzen - was kostet es an Zeit, Geld, Nerven, wenn es ungelöst bleibt? Konkrete Konsequenzen benennen, nicht nur behaupten.
3. Solution: die Lösung knapp und konkret liefern - kein vages Versprechen, sondern ein nachvollziehbarer Weg oder Prinzip.
Stilmittel: kurze, klare Sätze. Keine Weichmacher ("vielleicht", "eventuell"). Der Leser soll sich im Problem wiedererkennen, bevor die Lösung kommt.$desc$,
  $ex$### Beispiel:
Warum verschieben so viele Kanzleien die Digitalisierung immer wieder?

Weil jeder Tag ohne sie sich wie ein kleiner, verkraftbarer Verlust anfühlt. Ein Formular mehr von Hand, eine Akte mehr im Aktenschrank, eine Rückfrage mehr am Telefon.

Nach einem Jahr sind daraus hunderte Stunden geworden - bezahlt, aber ohne Mehrwert für den Mandanten.

Die Lösung beginnt nicht mit einem großen Softwareprojekt. Sie beginnt mit dem einen Prozess, der am meisten Zeit frisst - und der sich in zwei Wochen sauber abbilden lässt.

Nicht alles auf einmal. Aber genau jetzt der erste Schritt.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '3'), 1, 20),
  'Rage & Real Talk',
  $desc$Das Rage-Format sorgt für maximale Viralität auf Social Media, weil es extrem stark polarisiert. Merkmale:
- Startet mit einer extrem aufmerksamkeitsstarken, konfrontativen Aussage, die den Leser zwingt, weiterzulesen.
- Der Inhalt polarisiert bewusst - eine klare Haltung statt Beliebigkeit.
- Dünner Grat zwischen Satire und Ernst, aber am Ende wird klargestellt: es ist ernst gemeint.
- Kurze, harte Sätze. Keine Relativierungen, keine Konjunktive.
Vorsicht: polarisiert bewusst eine Meinung, nie eine Person oder Gruppe - Haltung statt Angriff.$desc$,
  $ex$### Beispiel:
Mein größtes Problem mit "Das haben wir schon immer so gemacht"?

Es ist keine Strategie. Es ist Bequemlichkeit mit Krawatte.

Ich sehe Kanzleien, die lieber jedes Jahr einen Mitarbeiter mehr einstellen, als einen einzigen Prozess zu hinterfragen.

Das ist kein Wachstum. Das ist Symptombekämpfung mit Gehaltsabrechnung.

Und ja - das ist kein Witz. Das ist mein Ernst.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '4'), 1, 20),
  'Education / Listicle',
  $desc$Lehrreicher Listen-Post mit hohem, sofort nutzbarem Praxiswert:
1. Hook: verspricht eine konkrete Zahl an Erkenntnissen/Tipps zu einem klar benannten Thema.
   Beispiel: "5 Dinge, die ich erst nach 10 Jahren im Geschäft verstanden habe."
2. Durchnummerierte Punkte (3-7): jeder Punkt ist in sich abgeschlossen, 1-3 Sätze, sofort verständlich auch ohne die anderen Punkte zu lesen.
3. Abschluss: kurze Zusammenfassung oder eine Frage, die zum Austausch in den Kommentaren einlädt.
Stilmittel: Klarheit vor Vollständigkeit - lieber ein Punkt weniger, aber jeder davon konkret und handlungsrelevant statt generisch.$desc$,
  $ex$### Beispiel:
5 Dinge, die ich erst nach Jahren in der Mandantenbetreuung verstanden habe:

1. Ein schneller "Nein, das geht nicht" ist schlechter als ein langsames "Lass uns das prüfen."
2. Mandanten merken nicht den Unterschied zwischen 2 und 20 Stunden Arbeit - aber immer den Unterschied zwischen Stille und einem kurzen Update.
3. Die beste Akquise ist der Mandant, der zufrieden genug ist, von sich aus zu erzählen.
4. Interne Prozesse, die niemand aufschreibt, sterben mit dem Mitarbeiter, der sie im Kopf hatte.
5. Komplexität verkauft sich schlechter als Klarheit - auch wenn die Materie komplex ist.

Was würdet ihr ergänzen?$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '5'), 1, 20),
  'Kontroverse These (Pattern Interrupt)',
  $desc$Durchbricht bewusst die Erwartungshaltung, um den Scroll zu stoppen (Pattern Interrupt):
1. Hook: widerspricht direkt im ersten Satz einer weitverbreiteten Branchen-Meinung oder "gesunden Menschenverstand"-Annahme. Keine Anlaufzeit, keine Einleitung.
   Beispiel: "Mehr Mitarbeiter lösen kein einziges Problem in eurer Kanzlei."
2. Begründung: warum die gängige Annahme in der Praxis nicht (mehr) stimmt - mit einem konkreten Beobachtungs- oder Erfahrungswert.
3. Neue Perspektive: die eigentliche, oft unbequemere Wahrheit dahinter aufbauen.
4. Kurzer Ausblick, was das für die Zielgruppe praktisch bedeutet.
Stilmittel: Behauptung zuerst, Beweis danach - nie umgekehrt. Kein "Ich finde...", sondern direkte Aussagen.$desc$,
  $ex$### Beispiel:
Mehr Mitarbeiter lösen kein einziges Problem in eurer Kanzlei.

Sie verteilen das Problem nur auf mehr Köpfe.

Ich habe Teams gesehen, die sich verdoppelt haben - und genauso viele Rückfragen, Doppelarbeit und Leerlauf hatten wie vorher. Nur teurer.

Das eigentliche Nadelöhr ist fast nie die Anzahl der Hände. Es ist der Prozess, durch den diese Hände arbeiten.

Bevor die nächste Stelle ausgeschrieben wird, lohnt sich eine einzige Frage: Woran genau scheitert es gerade - an Kapazität oder an Struktur?$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '6'), 1, 20),
  'Behind-the-Scenes / Vulnerability',
  $desc$Baut Vertrauen über Authentizität statt über Hochglanz-Erfolg auf:
1. Hook: gesteht direkt und ohne Umschweife etwas Unbequemes - einen Fehler, eine Unsicherheit, einen Rückschlag.
   Beispiel: "Ich habe letztes Jahr fast einen Mandanten verloren - durch meine eigene Schuld."
2. Kontext: was genau ist passiert, ohne zu beschönigen oder sich selbst zu rechtfertigen.
3. Reflexion: was daraus gelernt wurde - ehrlich, nicht als verkappter Flex.
4. Übertrag: was das für andere in einer ähnlichen Situation bedeuten kann.
Stilmittel: keine Selbstinszenierung als Opfer oder Held - nüchterne, ehrliche Schilderung auf Augenhöhe.$desc$,
  $ex$### Beispiel:
Ich habe letztes Jahr fast einen Mandanten verloren - durch meine eigene Schuld.

Ich hatte eine Frist im Kopf, nicht im Kalender. Zwei Tage vor Ablauf ist mir aufgefallen, dass ich sie falsch notiert hatte.

Kein Vorzeige-Moment. Nur Stress, ein unangenehmer Anruf und zwei Nächte, die ich nicht wiederholen möchte.

Seitdem landet bei uns jede Frist doppelt im System - einmal bei mir, einmal bei jemand anderem, der nichts mit dem Fall zu tun hat.

Nicht, weil ich besonders diszipliniert geworden bin. Sondern weil ich weiß, dass ich mich nicht auf mich allein verlassen sollte.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '7'), 1, 20),
  'Vorher-Nachher / Case Study',
  $desc$Ergebnisorientierter Beweis-Post, baut auf konkreten, nachvollziehbaren Zahlen auf:
1. Hook: nennt sofort ein konkretes Ergebnis oder eine Zahl, die neugierig macht.
   Beispiel: "Von 6 Wochen Bearbeitungszeit auf 9 Tage - ohne eine einzige neue Stelle."
2. Ausgangslage: der Zustand vorher, konkret beschrieben (Zahl, Zeitraum, Schmerzpunkt).
3. Maßnahme: was konkret verändert wurde - keine Buzzwords, ein nachvollziehbarer Schritt.
4. Ergebnis: der Zustand nachher, mit der gleichen Kennzahl wie im Hook, damit die Veränderung sichtbar wird.
Stilmittel: Zahlen und Fakten vor Adjektiven. Glaubwürdigkeit entsteht durch Konkretheit, nicht durch Superlative.$desc$,
  $ex$### Beispiel:
Von 6 Wochen Bearbeitungszeit auf 9 Tage - ohne eine einzige neue Stelle.

Vorher lag jede neue Akte im Schnitt 6 Wochen, bevor überhaupt die erste inhaltliche Prüfung begann. Nicht wegen fehlender Kompetenz - wegen fehlender Reihenfolge.

Wir haben nichts weiter verändert als die Zuteilung: eine feste Person prüft jede neue Akte innerhalb von 48 Stunden auf Vollständigkeit, bevor sie überhaupt zugewiesen wird.

Aus 6 Wochen wurden 9 Tage. Gleiche Mannschaft, gleiche Fälle - nur eine andere Reihenfolge.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '8'), 1, 20),
  'Mythos vs. Realität',
  $desc$Stellt eine weitverbreitete Branchen-Annahme der tatsächlichen Erfahrung gegenüber:
1. Hook: benennt einen konkreten, oft gehörten Mythos der Branche wörtlich.
   Beispiel: "'Digitalisierung lohnt sich erst ab einer gewissen Kanzleigröße' - stimmt das wirklich?"
2. Mythos: kurz erklären, warum dieser Glaubenssatz so verbreitet ist und woher er kommt.
3. Realität: mit einer konkreten Beobachtung oder einem Beispiel widerlegen oder einordnen.
4. Fazit: eine klare, einprägsame Aussage, die den Unterschied zwischen Mythos und Realität auf den Punkt bringt.
Stilmittel: fair bleiben - den Mythos nicht lächerlich machen, sondern sachlich einordnen und dann mit Substanz widerlegen.$desc$,
  $ex$### Beispiel:
"Digitalisierung lohnt sich erst ab einer gewissen Kanzleigröße" - stimmt das wirklich?

Dieser Satz hält sich hartnäckig, weil große Softwareprojekte tatsächlich teuer und aufwändig wirken.

Aber die größten Zeitfresser in kleinen Kanzleien sind selten komplexe Systeme - es sind einzelne, immer gleiche Handgriffe: derselbe E-Mail-Typ zehnmal am Tag, dieselbe Nachfrage zum Bearbeitungsstand.

Genau diese kleinen, wiederkehrenden Aufgaben lassen sich unabhängig von der Kanzleigröße automatisieren - oft innerhalb weniger Tage.

Die Größe entscheidet nicht, ob sich Digitalisierung lohnt. Sie entscheidet nur, wo man am besten anfängt.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '9'), 1, 20),
  'Autorität / Social Proof',
  $desc$1. Hook: startet mit einer konkreten, überprüfbaren Zahl (Anzahl Mandate, Jahre Erfahrung, Kennzahl) - keine vagen Superlative.
2. Beleg: ordnet die Zahl kurz ein - wofür steht sie, wie ist sie entstanden.
3. Mechanismus: ein Satz, der erklärt, worauf das Ergebnis beruht - System statt Zufall.
4. Weicher Abschluss: lädt zum Austausch/Gespräch ein, ohne aufdringlichen Verkaufston - auf Social Media wirkt ein hartes "Jetzt buchen" schnell plump.
Stilmittel: Zahlen und Fakten vor Adjektiven, keine Übertreibungen, die sich nicht belegen lassen.$desc$,
  $ex$### Beispiel:
Über 400 abgeschlossene Mandate allein in den letzten drei Jahren - und jedes einzelne mit derselben Sorgfalt wie das erste.

Das ist kein Zufall. Dahinter steckt ein fester Ablauf: klare Zuständigkeiten, feste Fristen-Kontrolle, ein zweites Augenpaar bei jeder wichtigen Entscheidung.

Genau diese Struktur macht den Unterschied zwischen "es hat geklappt" und "es klappt verlässlich, egal wie viele Mandate gleichzeitig laufen".

Wer wissen möchte, wie dieser Ablauf im Detail aussieht - gerne einfach schreiben.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '10'), 1, 20),
  'Zukunftsbild (Future Pacing)',
  $desc$1. Hook: "Stell dir vor..." gefolgt von einem konkreten, sinnlich vorstellbaren Zukunftsbild - nicht abstrakt, sondern eine Szene.
2. Traumbild ausmalen: 2-3 kurze, bildhafte Sätze oder Stichpunkte, wie der Alltag dann aussieht.
3. Machbarkeits-Brücke: ein Satz, der erklärt, warum dieses Bild realistisch erreichbar ist, nicht nur Wunschdenken.
4. Kurzer Hinweis auf den Weg dahin, ohne ihn bereits vollständig auszubreiten.
Stilmittel: Gegenwartsform fürs Zukunftsbild ("Du sitzt...", nicht "Du würdest sitzen"), damit es greifbar wirkt.$desc$,
  $ex$### Beispiel:
Stell dir vor, es ist Freitagnachmittag. Dein Kalender zeigt keine offenen Fristen mehr für diese Woche - alles ist terminiert, kontrolliert, erledigt.

Kein Blick mehr auf die Uhr aus Angst, etwas übersehen zu haben. Kein Stapel, der sich bis Montag türmt.

Das ist kein Zufallsprodukt eines ruhigen Monats. Es ist das Ergebnis eines Systems, das Fristen automatisch erfasst, statt sich auf das Gedächtnis Einzelner zu verlassen.

Genau an so einem System arbeiten wir gerade mit mehreren Kanzleien.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '11'), 1, 20),
  'Gemeinsamer Gegner',
  $desc$1. Hook: benennt eine geteilte Frustration über einen Zustand, eine Praxis oder eine Arbeitsweise - niemals eine Person oder Personengruppe angreifen, sondern ein Prinzip oder einen überholten Ansatz.
2. Identifikation: zeigt, dass die Zielgruppe denselben Ärger teilt und zu Recht mehr erwartet.
3. Gegenentwurf: die eigene Haltung oder Arbeitsweise, die bewusst anders ist.
4. Einladung: lädt die Leser ein, sich dieser Haltung anzuschließen.
Stilmittel: Wir-Gefühl aufbauen ("Wir finden...", "Genau wie du..."), Haltung statt Angriff auf Einzelne.$desc$,
  $ex$### Beispiel:
Was uns wirklich stört: Wenn Mandanten wochenlang auf eine Rückmeldung warten müssen, nur weil "gerade viel los ist".

Das akzeptieren wir nicht als Normalzustand - auch wenn es in der Branche oft so hingenommen wird.

Deshalb bekommt bei uns jede Anfrage innerhalb von 24 Stunden mindestens eine kurze Rückmeldung, auch wenn die eigentliche Antwort noch dauert.

Mandanten verdienen das Gefühl, nicht vergessen zu werden - und das ist für uns kein Kundenservice-Extra, sondern Grundvoraussetzung.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '12'), 1, 20),
  'Einwandbehandlung / FAQ',
  $desc$1. Hook: zitiert wörtlich eine Frage oder einen Zweifel, den die Zielgruppe tatsächlich häufig äußert (in Anführungszeichen).
2. Einordnung: erklärt kurz, warum dieser Einwand naheliegend und berechtigt ist - keine Abwertung der Frage.
3. Auflösung: beantwortet den Einwand mit Fakten, Erfahrung oder einem konkreten Prinzip.
4. Kurzes Beispiel oder Beleg, das die Auflösung greifbar macht.
Stilmittel: die Frage ernst nehmen, nicht als "dumme Frage" abtun - das baut Vertrauen auf.$desc$,
  $ex$### Beispiel:
"Lohnt sich eine Spezialisierung nicht erst ab einer gewissen Kanzleigröße?"

Diese Frage höre ich oft - und sie ist nachvollziehbar, weil Spezialisierung nach großem Marketingbudget klingt.

Tatsächlich ist das Gegenteil der Fall: Eine kleine Kanzlei mit klarer Spezialisierung wird schneller gefunden als eine große mit breitem, austauschbarem Angebot.

Eine Zwei-Personen-Kanzlei, die sich klar auf ein Thema fokussiert hat, bekommt heute mehr gezielte Anfragen als vorher mit einem breiten Leistungsangebot.

Größe entscheidet nicht über den Erfolg einer Spezialisierung - Klarheit schon.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '13'), 1, 20),
  'Framework / Schritt-für-Schritt-System',
  $desc$1. Hook: verspricht eine konkrete Anzahl an Schritten zu einem klar benannten Ergebnis.
2. Schrittübersicht: 3-6 Schritte, jeweils als kurzer Begriff oder Halbsatz benannt - keine Romane, nur Orientierung.
3. Einordnung: ein bis zwei Sätze, warum die Reihenfolge der Schritte wichtig ist oder was den größten Unterschied macht.
4. Kurzer Beleg, dass das System in der Praxis funktioniert.
Unterschied zu Education/Listicle: hier geht es um einen zusammenhängenden Prozess bzw. ein System, nicht um einzelne, voneinander unabhängige Tipps.
Stilmittel: knappe, parallele Formulierung der Schritte (gleiche Satzstruktur) - das wirkt wie ein echtes System statt einer losen Liste.$desc$,
  $ex$### Beispiel:
So sieht bei uns der Ablauf aus, mit dem neue Mandate nie mehr in der Warteschleife hängen bleiben:

1. Eingang prüfen - jede neue Akte wird innerhalb von 48 Stunden auf Vollständigkeit kontrolliert.
2. Fristen erfassen - sofort und doppelt, nie nur im Kopf einer Person.
3. Zuständigkeit festlegen - eine klare Verantwortung statt "wer gerade Zeit hat".
4. Zwischenstand kommunizieren - der Mandant hört spätestens nach einer Woche etwas von uns.
5. Abschluss dokumentieren - damit der nächste ähnliche Fall schneller geht.

Kein Schritt davon ist kompliziert. Der Unterschied liegt darin, dass alle fünf konsequent eingehalten werden.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '14'), 1, 20),
  'Identität',
  $desc$1. Hook: spricht die Berufsrolle der Zielgruppe direkt an und grenzt eine bestimmte Aufgabe klar von ihrer Kernkompetenz ab.
2. Identifikation: bestätigt, worin die Zielgruppe tatsächlich gut ist beziehungsweise sein sollte.
3. Entlastung: macht deutlich, dass es kein persönliches Versäumnis ist, diese eine Aufgabe nicht selbst zu beherrschen.
4. Übergabe: zeigt, wer diese Aufgabe stattdessen sinnvoll übernimmt - mit Bezug zum eigenen Angebot.
Stilmittel: Rollen klar benennen (Kanzleiinhaber, Steuerberaterin, Geschäftsführer), Wertschätzung statt Belehrung.$desc$,
  $ex$### Beispiel:
Als Kanzleiinhaber ist es nicht deine Aufgabe, dich nebenbei noch in Online-Marketing einzuarbeiten.

Deine Stärke liegt in der Mandatsarbeit - nicht darin, Anzeigen zu schalten oder Social-Media-Algorithmen zu verstehen.

Das ist kein Mangel. Die wenigsten Kanzleien haben dafür Zeit oder Lust, und das müssen sie auch nicht.

Genau dafür gibt es uns - damit du dich auf die Mandate konzentrierst, während im Hintergrund kontinuierlich neue Anfragen reinkommen.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '15'), 1, 20),
  'Dringlichkeit (faktenbasiert)',
  $desc$Nur für echte, nachprüfbare Fristen oder Veränderungen geeignet (z.B. Gesetzesänderung, Stichtag, Förderfrist) - niemals für künstlich erzeugten Druck oder erfundene Verknappung.
1. Hook: benennt die konkrete Frist oder Veränderung direkt und mit Datum/Zeitraum, wo möglich.
2. Einordnung: erklärt kurz, was sich dadurch ändert und für wen das relevant ist.
3. Konsequenz: was passiert, wenn man bis zur Frist nicht reagiert - sachlich, nicht dramatisierend.
4. Nächster Schritt: eine konkrete, machbare Handlung vor der Frist.
Stilmittel: Fakten und Daten vor Adjektiven, keine Übertreibung der Konsequenzen.$desc$,
  $ex$### Beispiel:
Ab dem kommenden Stichtag ändert sich eine Meldepflicht, die viele kleinere Betriebe aktuell noch gar nicht auf dem Schirm haben.

Wer die neue Frist verpasst, riskiert nicht nur Mehraufwand im Nachgang, sondern in manchen Fällen auch Verzugszinsen.

Der Aufwand, sich jetzt vorzubereiten, ist überschaubar - deutlich kleiner als die Korrektur im Nachhinein.

Wer unsicher ist, ob die neue Regelung das eigene Unternehmen betrifft, sollte das jetzt klären, nicht erst wenn die Frist näherrückt.$ex$,
  now(), now()
),
(
  'cfmt_' || substr(md5(random()::text || clock_timestamp()::text || '16'), 1, 20),
  'Paradoxon',
  $desc$1. Hook: eine auf den ersten Blick widersprüchliche Aussage nach dem Muster "Je weniger X, desto mehr Y" oder "Gerade weil X, deshalb Y".
2. Verwirrung stehen lassen: ein bis zwei Sätze, die den scheinbaren Widerspruch kurz bestätigen, statt ihn sofort aufzulösen.
3. Auflösung: erklärt, warum der Widerspruch in Wahrheit keiner ist - meist über einen verschobenen Fokus oder ein verändertes Prinzip.
4. Rückbindung an das eigene Angebot/Prinzip.
Stilmittel: die Spannung zwischen Hook und Auflösung bewusst ein bis zwei Sätze stehen lassen, bevor aufgelöst wird - das hält den Leser im Text.$desc$,
  $ex$### Beispiel:
Je weniger Mandate eine Kanzlei gleichzeitig betreut, desto mehr Umsatz macht sie pro Mandat.

Klingt erstmal falsch. Mehr Mandate sollte doch mehr Umsatz bedeuten.

Aber: Wer weniger, dafür anspruchsvollere Mandate annimmt, kann höhere Honorare verlangen und liefert dabei spürbar bessere Qualität - was wiederum zu Weiterempfehlungen führt.

Nicht die Anzahl der Mandate entscheidet über den Erfolg einer Kanzlei. Die Auswahl tut es.$ex$,
  now(), now()
);
