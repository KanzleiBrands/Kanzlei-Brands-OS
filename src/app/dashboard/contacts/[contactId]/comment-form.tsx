"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { postComment } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSaveToast } from "@/hooks/use-save-toast";

type MentionUser = { id: string; name: string };

export function CommentForm({
  contactId,
  mentionableUsers,
}: {
  contactId: string;
  mentionableUsers: MentionUser[];
}) {
  const [error, formAction, isPending] = useActionState(postComment, undefined);
  useSaveToast(error, isPending, "Kommentar gesendet.");
  const [content, setContent] = useState("");
  const [mentioned, setMentioned] = useState<Map<string, string>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<{ query: string; start: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      setContent("");
      setMentioned(new Map());
    }
    wasPending.current = isPending;
  }, [isPending, error]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setContent(value);
    const cursor = e.target.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const match = uptoCursor.match(/(?:^|\s)@([\wäöüÄÖÜß]*)$/);
    setMentionQuery(match ? { query: match[1].toLowerCase(), start: cursor - match[1].length - 1 } : null);
  }

  function insertMention(user: MentionUser) {
    if (!mentionQuery || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart ?? content.length;
    const before = content.slice(0, mentionQuery.start);
    const after = content.slice(cursor);
    setContent(`${before}@${user.name} ${after}`);
    setMentioned((prev) => new Map(prev).set(user.id, user.name));
    setMentionQuery(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const suggestions = useMemo(
    () =>
      mentionQuery
        ? mentionableUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.query)).slice(0, 5)
        : [],
    [mentionQuery, mentionableUsers],
  );

  // Drop a mention if its @Name text was deleted again, so it isn't submitted stale.
  const activeMentions = useMemo(
    () => [...mentioned.entries()].filter(([, name]) => content.includes(`@${name}`)),
    [mentioned, content],
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      {activeMentions.map(([id]) => (
        <input key={id} type="hidden" name="mentionedUserIds" value={id} />
      ))}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          name="content"
          value={content}
          onChange={handleChange}
          placeholder="Kommentar an die Gegenseite... (@ um jemanden gezielt zu markieren)"
          required
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-56 overflow-hidden rounded-md border bg-popover shadow-md">
            {suggestions.map((user) => (
              <button
                key={user.id}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => insertMention(user)}
              >
                {user.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Mit @Name jemanden gezielt benachrichtigen, sonst geht die Benachrichtigung an die gesamte Gegenseite.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} size="sm" className="self-start">
        {isPending ? "Wird gesendet..." : "Kommentar senden"}
      </Button>
    </form>
  );
}
