import * as React from "react";

import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

function PageContainer({ className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1100px] px-5 md:px-8", className)}
      {...props}
    />
  );
}

export { PageContainer };
