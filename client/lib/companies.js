export const COMPANIES = [
  { id: "Agnostic", name: "General", tagline: "Role-focused prep", color: "#94a3b8", initials: "★" },
  { id: "Google", name: "Google", tagline: "Scale & product sense", color: "#4285F4", initials: "G" },
  { id: "Amazon", name: "Amazon", tagline: "Leadership principles", color: "#FF9900", initials: "A" },
  { id: "Meta", name: "Meta", tagline: "Speed & ownership", color: "#0081FB", initials: "M" },
  { id: "Microsoft", name: "Microsoft", tagline: "Growth mindset", color: "#00A4EF", initials: "MS" },
  { id: "Netflix", name: "Netflix", tagline: "Culture & judgment", color: "#E50914", initials: "N" },
  { id: "Stripe", name: "Stripe", tagline: "Deep technical bar", color: "#635BFF", initials: "S" },
  { id: "Apple", name: "Apple", tagline: "Craft & clarity", color: "#A2AAAD", initials: "A" },
];

export function getCompany(id) {
  return COMPANIES.find((c) => c.id === id) || COMPANIES[0];
}
