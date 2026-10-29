import { MemberSchema, type Member } from "@circles/ai";
import { useEffect, useState } from "react";
import { z } from "zod";

const KEY = "circles.users";

function load(): Member[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = z.array(MemberSchema).safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data : [];
  } catch {
    return []; // storage blocked or corrupt: start empty
  }
}

/** Users held in state and mirrored to localStorage so they survive refreshes. */
export function useUsers() {
  const [users, setUsers] = useState<Member[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(users));
    } catch {
      // storage unavailable: state still works for this session
    }
  }, [users]);

  return {
    users,
    addUser: (u: Member) => setUsers((prev) => [...prev, u]),
    addUsers: (us: Member[]) => setUsers((prev) => [...prev, ...us]),
    removeUser: (id: string) =>
      setUsers((prev) => prev.filter((u) => u.id !== id)),
  };
}
