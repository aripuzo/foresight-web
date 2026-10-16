import { AuthForm } from "@/components/auth-form";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { closeAuthModal, openAuthModal, useAuthModal } from "@/lib/auth-modal";

export function AuthDialog() {
  const mode = useAuthModal();
  return (
    <Dialog open={mode !== null} onOpenChange={(v) => !v && closeAuthModal()}>
      <DialogContent className="max-w-md border-border bg-card p-6 sm:p-8">
        <DialogTitle className="sr-only">
          {mode === "signup" ? "Create your account" : "Sign in"}
        </DialogTitle>
        {mode && (
          <AuthForm key={mode} mode={mode} onSuccess={closeAuthModal} onSwitch={openAuthModal} />
        )}
      </DialogContent>
    </Dialog>
  );
}
