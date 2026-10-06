import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

describe("StyleSaathi Space UI / shadcn Component Integration", () => {
  describe("cn() utility", () => {
    it("correctly merges conflicting and conditional tailwind classes", () => {
      const result = cn(
        "px-2 py-1 text-xs",
        true && "bg-white",
        false && "hidden",
        "px-4"
      );
      expect(result).toBe("py-1 text-xs bg-white px-4");
    });
  });

  describe("Button component", () => {
    it("renders default variant with StyleSaathi kumkum accent styling and 44px min touch target", () => {
      const html = renderToString(<Button>Curate Look</Button>);
      expect(html).toContain("bg-(--accent)");
      expect(html).toContain("min-h-11");
      expect(html).toContain("Curate Look");
    });

    it("renders secondary and gold variants cleanly", () => {
      const secHtml = renderToString(<Button variant="secondary">View Wardrobe</Button>);
      const goldHtml = renderToString(<Button variant="gold">Royal Heritage</Button>);
      expect(secHtml).toContain("border-(--border)");
      expect(goldHtml).toContain("border-(--gold-rule)");
    });

    it("exposes buttonVariants helper", () => {
      const classes = buttonVariants({ variant: "destructive", size: "sm" });
      expect(classes).toContain("bg-(--danger)");
      expect(classes).toContain("min-h-9");
    });
  });

  describe("Badge component", () => {
    it("renders Indian heritage accent variants", () => {
      const marigoldHtml = renderToString(<Badge variant="marigold">Festive</Badge>);
      const mehndiHtml = renderToString(<Badge variant="mehndi">Handloom</Badge>);
      const indigoHtml = renderToString(<Badge variant="indigo">Silk</Badge>);
      expect(marigoldHtml).toContain("text-(--marigold)");
      expect(mehndiHtml).toContain("text-(--mehndi)");
      expect(indigoHtml).toContain("text-(--indigo)");
    });

    it("exposes badgeVariants helper", () => {
      const classes = badgeVariants({ variant: "gold" });
      expect(classes).toContain("text-(--burnished-gold)");
    });
  });

  describe("Card component", () => {
    it("renders with editorial paper surface and font-serif title", () => {
      const html = renderToString(
        <Card>
          <CardHeader>
            <CardTitle>Bandhani Silk Saree</CardTitle>
          </CardHeader>
          <CardContent>Handwoven in Gujarat</CardContent>
        </Card>
      );
      expect(html).toContain("font-serif");
      expect(html).toContain("Bandhani Silk Saree");
      expect(html).toContain("Handwoven in Gujarat");
      expect(html).toContain("bg-card");
    });
  });

  describe("Separator component", () => {
    it("supports textile and gold rule dividers", () => {
      const textileHtml = renderToString(<Separator variant="textile" />);
      const goldHtml = renderToString(<Separator variant="gold" />);
      expect(textileHtml).toContain("textile-divider");
      expect(goldHtml).toContain("gold-accent-rule");
    });
  });

  describe("Tabs component", () => {
    it("renders tabs list and content with pill active styling", () => {
      const html = renderToString(
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Items</TabsTrigger>
            <TabsTrigger value="tops">Tops</TabsTrigger>
          </TabsList>
          <TabsContent value="all">All Items Content</TabsContent>
          <TabsContent value="tops">Tops Content</TabsContent>
        </Tabs>
      );
      expect(html).toContain("All Items");
      expect(html).toContain("Tops");
      expect(html).toContain("All Items Content");
    });
  });
});
