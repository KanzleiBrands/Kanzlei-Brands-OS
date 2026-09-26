/**
 * EasyBill-REST-Client fürs Cashflow Cockpit - Cash-In basiert ausschließlich
 * auf tatsächlich gestellten/geplanten Rechnungen (EasyBill), bewusst KEIN
 * Close.io-Bezug (Auftragsvolumen != Cashflow). Nichts wird gespiegelt: jede
 * Cockpit-Ansicht liest live. API-Doku: https://api.easybill.de/rest/v1/swagger.json
 * (gegen die echte, veröffentlichte OpenAPI-Spezifikation geprüft - Auth per
 * Bearer-Token, Felder amount/amount_net in Cent, Paginierung via page/pages).
 */
const EASYBILL_API_BASE = "https://api.easybill.de/rest/v1";

function easybillAuthHeader(apiKey: string): string {
  return `Bearer ${apiKey}`;
}

type EasybillListResponse<T> = { page: number; pages: number; limit: number; total: number; items: T[] };

async function easybillFetchAll<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  for (;;) {
    const url = new URL(`${EASYBILL_API_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("limit", "1000");
    url.searchParams.set("page", String(page));
    const res = await fetch(url.toString(), { headers: { Authorization: easybillAuthHeader(apiKey) } });
    if (!res.ok) throw new Error(`EasyBill-Abfrage fehlgeschlagen (${res.status}) - ${path}`);
    const data = (await res.json()) as EasybillListResponse<T>;
    results.push(...data.items);
    if (page >= data.pages || data.items.length === 0) break;
    page += 1;
  }
  return results;
}

type EasybillDocumentPosition = { description: string | null; vat_percent: number };

type EasybillDocumentRecurring = {
  next_date: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  frequency_special: "LASTDAYOFMONTH" | null;
  interval: number;
  status: "RUNNING" | "PAUSE" | "STOP" | "WAITING";
  target_type: string;
};

type EasybillDocument = {
  id: number;
  type: string;
  customer_id: number | null;
  document_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  is_draft: boolean;
  amount: number; // Cent, Brutto
  amount_net: number; // Cent, Netto
  number: string | null;
  items: EasybillDocumentPosition[];
  recurring_options: EasybillDocumentRecurring | null;
};

type EasybillCustomer = { id: number; company_name: string | null };

export type EasybillResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

export type CashInStatus = "GEPLANT" | "BEZAHLT" | "UEBERFAELLIG";

export type CashInEntry = {
  easybillDocumentId: number;
  customerId: number | null;
  customerLabel: string;
  product: string;
  invoiceDate: string; // ISO-Datum
  dueDate: string | null;
  amountNet: number; // €
  amountGross: number; // €
  taxRatePercent: number;
  status: CashInStatus;
  number: string | null;
  isForecast: boolean;
};

function productLabel(items: EasybillDocumentPosition[]): string {
  const names = items.map((item) => item.description).filter((d): d is string => Boolean(d?.trim()));
  return names.length > 0 ? Array.from(new Set(names)).join(", ") : "–";
}

function documentStatus(doc: Pick<EasybillDocument, "is_draft" | "paid_at" | "due_date">, today: Date): CashInStatus {
  if (doc.paid_at) return "BEZAHLT";
  if (doc.is_draft) return "GEPLANT";
  if (doc.due_date && new Date(doc.due_date) < today) return "UEBERFAELLIG";
  return "GEPLANT";
}

async function fetchCustomerLabels(apiKey: string): Promise<Map<number, string>> {
  const customers = await easybillFetchAll<EasybillCustomer>("/customers", {}, apiKey);
  return new Map(customers.map((c) => [c.id, c.company_name ?? `Kunde #${c.id}`]));
}

/** Tatsächlich gestellte Rechnungen eines Jahres (Cash-In, keine Vorlagen). */
export async function listCashInForYear(year: number): Promise<EasybillResult<CashInEntry>> {
  const apiKey = process.env.EASYBILL_API_KEY;
  if (!apiKey) return { ok: false, error: "EASYBILL_API_KEY ist nicht konfiguriert." };

  try {
    const today = new Date();
    const [documents, customerLabels] = await Promise.all([
      easybillFetchAll<EasybillDocument>("/documents", { type: "INVOICE", document_date: `${year}-01-01,${year}-12-31` }, apiKey),
      fetchCustomerLabels(apiKey),
    ]);

    const rows: CashInEntry[] = documents
      .filter((doc) => doc.document_date)
      .map((doc) => ({
        easybillDocumentId: doc.id,
        customerId: doc.customer_id,
        customerLabel: doc.customer_id ? (customerLabels.get(doc.customer_id) ?? "Unbekannt") : "Unbekannt",
        product: productLabel(doc.items),
        invoiceDate: doc.document_date as string,
        dueDate: doc.due_date,
        amountNet: doc.amount_net / 100,
        amountGross: doc.amount / 100,
        taxRatePercent: doc.items[0]?.vat_percent ?? 19,
        status: documentStatus(doc, today),
        number: doc.number,
        isForecast: false,
      }));
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der EasyBill-Abfrage." };
  }
}

/**
 * Forecast künftiger Rechnungen aus laufenden wiederkehrenden Vorlagen
 * (type=RECURRING, recurring_options.status=RUNNING) - projiziert die
 * nächsten `monthsAhead` Termine ab recurring_options.next_date anhand von
 * frequency/interval. Beträge/Produkt stammen aus der Vorlage selbst.
 */
export async function listCashInForecast(monthsAhead: number): Promise<EasybillResult<CashInEntry>> {
  const apiKey = process.env.EASYBILL_API_KEY;
  if (!apiKey) return { ok: false, error: "EASYBILL_API_KEY ist nicht konfiguriert." };

  try {
    const [templates, customerLabels] = await Promise.all([
      easybillFetchAll<EasybillDocument>("/documents", { type: "RECURRING" }, apiKey),
      fetchCustomerLabels(apiKey),
    ]);

    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + monthsAhead);

    const rows: CashInEntry[] = [];
    for (const doc of templates) {
      const recurring = doc.recurring_options;
      if (!recurring || recurring.status !== "RUNNING" || recurring.target_type !== "INVOICE") continue;

      let occurrence = new Date(recurring.next_date);
      const step = () => {
        const next = new Date(occurrence);
        if (recurring.frequency === "DAILY") next.setDate(next.getDate() + recurring.interval);
        else if (recurring.frequency === "WEEKLY") next.setDate(next.getDate() + 7 * recurring.interval);
        else if (recurring.frequency === "YEARLY") next.setFullYear(next.getFullYear() + recurring.interval);
        else next.setMonth(next.getMonth() + recurring.interval);
        return next;
      };

      while (occurrence <= horizon) {
        rows.push({
          easybillDocumentId: doc.id,
          customerId: doc.customer_id,
          customerLabel: doc.customer_id ? (customerLabels.get(doc.customer_id) ?? "Unbekannt") : "Unbekannt",
          product: productLabel(doc.items),
          invoiceDate: occurrence.toISOString().slice(0, 10),
          dueDate: null,
          amountNet: doc.amount_net / 100,
          amountGross: doc.amount / 100,
          taxRatePercent: doc.items[0]?.vat_percent ?? 19,
          status: "GEPLANT",
          number: null,
          isForecast: true,
        });
        occurrence = step();
      }
    }
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der EasyBill-Abfrage." };
  }
}

/** Alle EasyBill-Kunden (id + Firmenname) - für die Kunden-Zuordnung im Cashflow Cockpit. */
export async function listEasybillCustomers(): Promise<EasybillResult<{ id: number; companyName: string }>> {
  const apiKey = process.env.EASYBILL_API_KEY;
  if (!apiKey) return { ok: false, error: "EASYBILL_API_KEY ist nicht konfiguriert." };

  try {
    const customers = await easybillFetchAll<EasybillCustomer>("/customers", {}, apiKey);
    return { ok: true, rows: customers.map((c) => ({ id: c.id, companyName: c.company_name ?? `Kunde #${c.id}` })) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler bei der EasyBill-Abfrage." };
  }
}
