import type { User } from "@shared/schema";

export function isTutor(user: User | undefined): boolean {
  return user?.role === "tutor";
}

export function isTD(user: User | undefined): boolean {
  return user?.role === "td";
}

export function isCOO(user: User | undefined): boolean {
  return user?.role === "coo";
}

export function isAffiliate(user: User | undefined): boolean {
  return user?.role === "affiliate";
}

export function isOD(user: User | undefined): boolean {
  return user?.role === "od";
}

export function isParent(user: User | undefined): boolean {
  return user?.role === "parent";
}

export function getRoleName(role: string): string {
  switch (role) {
    case "tutor":
      return "Specialist";
    case "td":
      return "Territory Director";
    case "coo":
      return "Chief Operations Officer";
    case "hr":
      return "Head of HR";
    case "ceo":
      return "Chief Executive Officer";
    case "cto":
      return "Chief Technology Officer";
    case "cmo":
      return "Chief Marketing Officer";
    case "od":
      return "Outreach Director";
    case "affiliate":
      return "Affiliate";
    case "parent":
      return "Parent";
    case "student":
      return "Student";
    default:
      return "User";
  }
}

export function getRoleNameShort(role: string): string {
  switch (role) {
    case "tutor":
      return "Specialist";
    case "td":
      return "TD";
    case "coo":
      return "COO";
    case "hr":
      return "HoHR";
    case "ceo":
      return "CEO";
    case "cto":
      return "CTO";
    case "cmo":
      return "CMO";
    case "od":
      return "OD";
    case "affiliate":
      return "Affiliate";
    case "parent":
      return "Parent";
    case "student":
      return "Student";
    default:
      return "User";
  }
}

export function getRoleColor(role: string): string {
  switch (role) {
    case "tutor":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "td":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "coo":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "hr":
      return "bg-pink-100 text-pink-800 border-pink-200";
    case "ceo":
      return "bg-slate-100 text-slate-800 border-slate-200";
    case "cto":
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "cmo":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "od":
      return "bg-lime-100 text-lime-800 border-lime-200";
    case "affiliate":
      return "bg-green-100 text-green-800 border-green-200";
    case "parent":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "student":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}
