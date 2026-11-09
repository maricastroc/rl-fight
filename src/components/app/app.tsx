"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect } from "react";
import { ConfigureStep } from "@/components/steps/configure/configure-step";
import { GenerateStep } from "@/components/steps/generate/generate-step";
import { ImportStep } from "@/components/steps/import/import-step";
import { ReviewStep } from "@/components/steps/review/review-step";
import { SessionProvider, useSession } from "@/state/session";
import { TemplateProvider } from "@/state/template";
import { MobileHeader, StepRail } from "./step-nav";

/** Dropping a file outside the drop zone would make the browser open it and leave the app. */
function usePreventFileNavigation() {
  useEffect(() => {
    const prevent = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);
}

function Shell() {
  const { state } = useSession();
  usePreventFileNavigation();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1680px]">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-bone-50 px-3 py-2 text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <StepRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main id="conteudo" className="flex flex-1 flex-col px-4 pt-9 sm:px-8 lg:px-14 lg:pt-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state.step}
              className="flex flex-1 flex-col"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" } }}
            >
              {state.step === "import" && <ImportStep />}
              {state.step === "review" && <ReviewStep />}
              {state.step === "configure" && <ConfigureStep />}
              {state.step === "generate" && <GenerateStep />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SessionProvider>
        <TemplateProvider>
          <Shell />
        </TemplateProvider>
      </SessionProvider>
    </MotionConfig>
  );
}
