"use client";

import { useI18n } from "@/i18n/context";
import { useState } from "react";

export type CustomerContact = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  notes: string;
  customer?: { id: string; name: string };
};

type CustomerOption = { id: string; name: string };

type ContactForm = {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  notes: string;
};

type CustomerContactsPanelProps = {
  contacts?: CustomerContact[];
  customers?: CustomerOption[];
  fixedCustomerId?: string;
  readOnly?: boolean;
  showList?: boolean;
  onChanged?: () => void | Promise<void>;
};

const emptyContactForm: ContactForm = {
  customerId: "",
  name: "",
  email: "",
  phone: "",
  title: "",
  notes: "",
};

function contactToForm(contact: CustomerContact): ContactForm {
  return {
    customerId: contact.customerId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    title: contact.title,
    notes: contact.notes,
  };
}

function ContactFields({
  form,
  customers,
  fixedCustomerId,
  disabled,
  idPrefix,
  onChange,
}: {
  form: ContactForm;
  customers: CustomerOption[];
  fixedCustomerId?: string;
  disabled?: boolean;
  idPrefix: string;
  onChange: (next: ContactForm) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      {fixedCustomerId ? null : (
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t("common.customer")}
          </span>
          <select
            className="input"
            required
            disabled={disabled}
            value={form.customerId}
            onChange={(e) => onChange({ ...form, customerId: e.target.value })}
          >
            <option value="">{t("common.selectCustomer")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {t("common.name")}
        </span>
        <input
          id={`${idPrefix}-name`}
          className="input"
          required
          disabled={disabled}
          value={form.name}
          placeholder={t("customerContacts.namePlaceholder")}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {t("common.email")}
        </span>
        <input
          id={`${idPrefix}-email`}
          className="input"
          type="email"
          disabled={disabled}
          value={form.email}
          placeholder={t("customerContacts.emailPlaceholder")}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {t("customerContacts.phone")}
        </span>
        <input
          id={`${idPrefix}-phone`}
          className="input"
          type="tel"
          disabled={disabled}
          value={form.phone}
          placeholder={t("customerContacts.phonePlaceholder")}
          onChange={(e) => onChange({ ...form, phone: e.target.value })}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {t("customerContacts.titleLabel")}
        </span>
        <input
          id={`${idPrefix}-title`}
          className="input"
          disabled={disabled}
          value={form.title}
          placeholder={t("customerContacts.titlePlaceholder")}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm md:col-span-2">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {t("customerContacts.notes")}
        </span>
        <textarea
          id={`${idPrefix}-notes`}
          className="input min-h-[72px]"
          disabled={disabled}
          value={form.notes}
          placeholder={t("customerContacts.notesPlaceholder")}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      </label>
    </>
  );
}

export function CustomerContactsPanel({
  contacts = [],
  customers = [],
  fixedCustomerId,
  readOnly = false,
  showList = true,
  onChanged,
}: CustomerContactsPanelProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<ContactForm>({
    ...emptyContactForm,
    customerId: fixedCustomerId ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ContactForm>(emptyContactForm);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const notifyChanged = async () => {
    await onChanged?.();
  };

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/customer-contacts", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, customerId: fixedCustomerId ?? form.customerId }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("customerContacts.couldNotCreate"));
      return;
    }
    setForm({ ...emptyContactForm, customerId: fixedCustomerId ?? "" });
    await notifyChanged();
  };

  const saveContact = async (contactId: string) => {
    setUpdatingId(contactId);
    const res = await fetch(`/api/customer-contacts/${encodeURIComponent(contactId)}`, {
      method: "PATCH",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setUpdatingId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("customerContacts.couldNotSave"));
      return;
    }
    setEditingId(null);
    await notifyChanged();
  };

  const deleteContact = async (contact: CustomerContact) => {
    if (!confirm(t("customerContacts.deleteConfirm", { name: contact.name }))) return;
    setDeletingId(contact.id);
    const res = await fetch(`/api/customer-contacts/${encodeURIComponent(contact.id)}`, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    });
    setDeletingId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? t("customerContacts.couldNotDelete"));
      return;
    }
    await notifyChanged();
  };

  return (
    <div className="space-y-4">
      {readOnly ? null : (
        <form onSubmit={createContact} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ContactFields
            form={form}
            customers={customers}
            fixedCustomerId={fixedCustomerId}
            disabled={saving}
            idPrefix="new-contact"
            onChange={setForm}
          />
          <div className="flex items-end md:col-span-2 xl:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? t("customerContacts.adding") : t("customerContacts.addContact")}
            </button>
          </div>
        </form>
      )}

      {showList ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
            {t("customerContacts.savedContacts", { count: String(contacts.length) })}
          </p>
          {contacts.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t("customerContacts.none")}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {contacts.map((contact) => {
                const editing = editingId === contact.id;
                return (
                  <li key={contact.id} className="px-3 py-3 text-sm">
                    {editing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <ContactFields
                            form={editForm}
                            customers={customers}
                            fixedCustomerId={fixedCustomerId}
                            disabled={updatingId === contact.id}
                            idPrefix={`edit-contact-${contact.id}`}
                            onChange={setEditForm}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-primary rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                            disabled={updatingId === contact.id}
                            onClick={() => void saveContact(contact.id)}
                          >
                            {updatingId === contact.id ? t("common.saving") : t("common.save")}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary rounded-md px-3 py-1.5 text-xs font-medium"
                            onClick={() => setEditingId(null)}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {contact.name}
                            </p>
                            {contact.title ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {contact.title}
                              </p>
                            ) : null}
                          </div>
                          {fixedCustomerId || !contact.customer?.name ? null : (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {contact.customer.name}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-700 dark:text-zinc-300">
                            {contact.email ? (
                              <a className="link-accent underline" href={`mailto:${contact.email}`}>
                                {contact.email}
                              </a>
                            ) : null}
                            {contact.phone ? (
                              <a className="link-accent underline" href={`tel:${contact.phone}`}>
                                {contact.phone}
                              </a>
                            ) : null}
                            {!contact.email && !contact.phone ? (
                              <span className="text-zinc-500 dark:text-zinc-400">
                                {t("customerContacts.noDirectContact")}
                              </span>
                            ) : null}
                          </div>
                          {contact.notes ? (
                            <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                              {contact.notes}
                            </p>
                          ) : null}
                        </div>
                        {readOnly ? null : (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-secondary rounded-md px-3 py-1.5 text-xs font-medium"
                              onClick={() => {
                                setEditingId(contact.id);
                                setEditForm(contactToForm(contact));
                              }}
                            >
                              {t("customerContacts.edit")}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                              disabled={deletingId === contact.id}
                              onClick={() => void deleteContact(contact)}
                            >
                              {deletingId === contact.id
                                ? t("customerContacts.deleting")
                                : t("common.delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
