"use client";

import * as React from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () => {
      const queryClient: QueryClient = new QueryClient({
        // Almost every mutation writes an activity-log entry server-side, so
        // refresh any open Activity view after each one.
        mutationCache: new MutationCache({
          onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activity"] }),
        }),
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      });
      return queryClient;
    },
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={200}>
          <ConfirmProvider>{children}</ConfirmProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
