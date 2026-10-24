export type NavItem = {
  label: string;
  href: string;
  children?: Array<{ label: string; href: string }>;
};

export const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Fighters",
    href: "/fighters",
    children: [
      { label: "Rankings", href: "/rankings" },
      { label: "Register", href: "/register" },
      { label: "Compete", href: "/events" },
    ],
  },
  {
    label: "Clubs",
    href: "/clubs",
    children: [
      { label: "Overview", href: "/clubs" },
      { label: "Join WUCO as a Club", href: "/clubs/join" },
    ],
  },
  {
    label: "Promoters & Events",
    href: "/events",
    children: [
      { label: "Upcoming Events", href: "/events" },
      { label: "Become a Promoter", href: "/promoters/join" },
      { label: "Promoter Directory", href: "/promoters" },
    ],
  },
  { label: "About Us", href: "/about" },
];
