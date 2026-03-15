import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { createServiceClient } from "./supabase";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return true;

      try {
        const supabase = createServiceClient();

        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("email", user.email)
          .single();

        if (!existing) {
          await supabase.from("users").insert({
            email: user.email,
            name: user.name ?? "",
            avatar_url: user.image ?? "",
            provider: account?.provider ?? "oauth",
            plan: "free",
          });
        }
      } catch (err) {
        console.error("Error in signIn callback:", err);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }

      // Attach Supabase user ID to the token
      if (token.email && !token.supabaseUserId) {
        try {
          const supabase = createServiceClient();
          const { data } = await supabase
            .from("users")
            .select("id")
            .eq("email", token.email)
            .single();

          if (data) {
            token.supabaseUserId = data.id;
          }
        } catch (err) {
          console.error("Error fetching Supabase user ID:", err);
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? "";
        session.user.email = token.email ?? "";
        session.user.image = (token.picture as string) ?? "";
        // Expose the Supabase UUID to the client
        (session.user as unknown as Record<string, unknown>).id =
          (token.supabaseUserId as string) ?? "";
      }
      return session;
    },
  },
});
