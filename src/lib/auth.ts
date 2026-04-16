import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const allowedDomain = process.env.ALLOWED_DOMAIN;
      if (!allowedDomain) return true;
      const email = profile?.email ?? "";
      return email.endsWith(`@${allowedDomain}`);
    },
  },
  pages: {
    signIn: "/login",
  },
});
