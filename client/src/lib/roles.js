export function isTutor(user) {
    return (user === null || user === void 0 ? void 0 : user.role) === "tutor";
}
export function isTD(user) {
    return (user === null || user === void 0 ? void 0 : user.role) === "td";
}
export function isCOO(user) {
    return (user === null || user === void 0 ? void 0 : user.role) === "coo";
}
export function isAffiliate(user) {
    return (user === null || user === void 0 ? void 0 : user.role) === "affiliate";
}
export function isOD(user) {
    return (user === null || user === void 0 ? void 0 : user.role) === "od";
}
export function isParent(user) {
    return (user === null || user === void 0 ? void 0 : user.role) === "parent";
}
export function getRoleName(role) {
    switch (role) {
        case "tutor":
            return "Specialist";
        case "td":
            return "Territory Director";
        case "coo":
            return "Chief Operations Officer";
        case "hr":
            return "Head of HR";
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
export function getRoleNameShort(role) {
    switch (role) {
        case "tutor":
            return "Specialist";
        case "td":
            return "TD";
        case "coo":
            return "COO";
        case "hr":
            return "HoHR";
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
export function getRoleColor(role) {
    switch (role) {
        case "tutor":
            return "bg-blue-100 text-blue-800 border-blue-200";
        case "td":
            return "bg-purple-100 text-purple-800 border-purple-200";
        case "coo":
            return "bg-amber-100 text-amber-800 border-amber-200";
        case "hr":
            return "bg-pink-100 text-pink-800 border-pink-200";
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
