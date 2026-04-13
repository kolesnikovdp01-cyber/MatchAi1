import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { LanguageProvider } from "@/contexts/language";

import Dashboard from "@/pages/dashboard";
import AiPredictions from "@/pages/ai-predictions";
import AuthorPredictions from "@/pages/author-predictions";
import Statistics from "@/pages/statistics";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import About from "@/pages/about";
import Admin from "@/pages/admin";
import Earn from "@/pages/earn";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={Admin} />
      <Route path="/earn" component={Earn} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/ai" component={AiPredictions} />
            <Route path="/author" component={AuthorPredictions} />
            <Route path="/statistics" component={Statistics} />
            <Route path="/history" component={History} />
            <Route path="/settings" component={Settings} />
            <Route path="/about" component={About} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
