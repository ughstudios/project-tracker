"use client";

import { useI18n } from "@/i18n/context";
import { useDeferredValue, useId, useMemo, useState } from "react";

type UserOption = {
  id: string;
  name: string | null;
  email: string | null;
};

type UserMultiSelectProps = {
  users: UserOption[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
  maxResults?: number;
};

function userDisplayName(user: UserOption) {
  return user.name?.trim() || user.email?.trim() || user.id;
}

function userSearchText(user: UserOption) {
  return `${user.name ?? ""} ${user.email ?? ""}`.trim().toLowerCase();
}

export function UserMultiSelect({
  users,
  selectedIds,
  onChange,
  disabled = false,
  compact = false,
  maxResults = compact ? 8 : 12,
}: UserMultiSelectProps) {
  const { t } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const selectedUsers = useMemo(
    () =>
      selectedIds
        .map((id) => usersById.get(id))
        .filter((user): user is UserOption => Boolean(user)),
    [selectedIds, usersById],
  );

  const totalMatches = useMemo(() => {
    if (!deferredQuery) return 0;
    return users.filter((user) => userSearchText(user).includes(deferredQuery)).length;
  }, [deferredQuery, users]);

  const matchingUsers = useMemo(() => {
    if (!deferredQuery) return [];
    return users
      .filter((user) => userSearchText(user).includes(deferredQuery))
      .slice(0, maxResults);
  }, [deferredQuery, maxResults, users]);

  const updateSelection = (userId: string) => {
    if (disabled) return;
    if (selectedSet.has(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
      return;
    }
    onChange([...selectedIds, userId]);
  };

  const chipClassName = compact
    ? "inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200"
    : "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200";

  const searchInputClassName = compact ? "input w-full text-xs" : "input w-full text-sm";
  const resultListClassName = compact
    ? "max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/40"
    : "max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/40";

  return (
    <div className="space-y-2">
      <label htmlFor={searchId} className="sr-only">
        {t("issues.assigneeSearchPlaceholder")}
      </label>
      <input
        id={searchId}
        className={searchInputClassName}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("issues.assigneeSearchPlaceholder")}
        autoComplete="off"
        disabled={disabled}
      />

      <div className="flex flex-wrap gap-2">
        {selectedUsers.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("issues.assigneeNoneSelected")}
          </p>
        ) : (
          selectedUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => updateSelection(user.id)}
              disabled={disabled}
              className={`${chipClassName} ${disabled ? "cursor-default" : "hover:border-zinc-300 hover:bg-zinc-100 dark:hover:border-white/20 dark:hover:bg-zinc-800"}`}
              title={disabled ? userDisplayName(user) : `${userDisplayName(user)} · ${t("common.remove")}`}
            >
              <span className="max-w-[14rem] truncate">{userDisplayName(user)}</span>
              {disabled ? null : <span aria-hidden>x</span>}
            </button>
          ))
        )}
      </div>

      {deferredQuery ? (
        <>
          <div className={resultListClassName}>
            {matchingUsers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                {t("issues.assigneeNoMatch")}
              </p>
            ) : (
              matchingUsers.map((user) => {
                const selected = selectedSet.has(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => updateSelection(user.id)}
                    disabled={disabled}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${compact ? "text-xs" : "text-sm"} ${
                      selected
                        ? "bg-zinc-50 text-zinc-900 dark:bg-zinc-900/80 dark:text-zinc-100"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900/80"
                    } ${disabled ? "cursor-default opacity-70" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{userDisplayName(user)}</p>
                      {user.email ? (
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {user.email}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {selected ? t("common.remove") : t("common.add")}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {totalMatches > matchingUsers.length ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("issues.assigneeResultsTruncated", {
                shown: String(matchingUsers.length),
                total: String(totalMatches),
              })}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("issues.assigneeSearchHint")}
        </p>
      )}
    </div>
  );
}
