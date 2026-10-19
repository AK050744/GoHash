function AppBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
    >
      <div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-blue/25 blur-3xl" />
      <div className="absolute top-1/3 -right-40 size-[30rem] rounded-full bg-yellow/40 blur-3xl" />
    </div>
  );
}

export { AppBackground };
