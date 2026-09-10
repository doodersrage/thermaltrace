/** Display labels for household roles (DB values stay owner/member/viewer/…). */
export function householdRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "member":
      return "Editor";
    case "viewer":
      return "Viewer";
    case "alert_only":
      return "Alert only";
    default:
      return role ? role.replace(/_/g, " ") : "";
  }
}
