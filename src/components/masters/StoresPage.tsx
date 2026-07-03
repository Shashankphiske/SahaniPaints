import { ArrowRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function StoresPage() {
  const targetUrl = "https://sheeladecorfrontend.netlify.app";

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="relative w-full max-w-md overflow-hidden border border-slate-100 shadow-xl dark:border-zinc-800">
        <div className="absolute -left-16 -top-16 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -right-16 -bottom-16 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
        
        <CardHeader className="relative flex flex-col items-center text-center pb-6">
          <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary dark:bg-primary/20">
            <Store className="h-10 w-10" />
          </div>
          <CardTitle className="font-display text-2xl font-bold">
            Switch Store
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-zinc-400 mt-2">
            Click the button below to open our sister store, <span className="font-semibold text-primary">Sheela Decor</span>.
          </CardDescription>
        </CardHeader>

        <CardFooter className="relative flex flex-col gap-3">
          <Button
            asChild
            className="w-full py-6 font-semibold"
          >
            <a href={targetUrl} className="flex items-center justify-center gap-2">
              Switch to Sheela Decor
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="outline"
            className="w-full py-6 font-semibold"
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
