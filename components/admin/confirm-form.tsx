"use client";

type ConfirmFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  confirmMessage: string;
};

export function ConfirmForm({
  action,
  children,
  confirmMessage
}: ConfirmFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
