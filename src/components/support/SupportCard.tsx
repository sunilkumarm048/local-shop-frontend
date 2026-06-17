'use client';

import { Phone, MessageCircle, Mail, LifeBuoy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SUPPORT, supportWhatsappUrl, supportMailto } from '@/lib/support';

interface Props {
  /** When set, WhatsApp and email are prefilled with this order's reference. */
  orderId?: string;
  /** Compact = a single row of buttons without the Card wrapper (for dashboards). */
  compact?: boolean;
  className?: string;
}

export function SupportCard({ orderId, compact, className }: Props) {
  const buttons = (
    <div className="flex flex-wrap gap-2">
      <a href={SUPPORT.phoneTel}>
        <Button size="sm" variant="outline">
          <Phone className="h-4 w-4 mr-2" />
          Call
        </Button>
      </a>
      <a href={supportWhatsappUrl(orderId)} target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="outline">
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </Button>
      </a>
      <a href={supportMailto(orderId)}>
        <Button size="sm" variant="outline">
          <Mail className="h-4 w-4 mr-2" />
          Email
        </Button>
      </a>
    </div>
  );

  if (compact) {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <LifeBuoy className="h-3.5 w-3.5" />
          Need help? Contact support
        </div>
        {buttons}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 font-medium mb-1">
          <LifeBuoy className="h-4 w-4 text-primary" />
          Need help with this order?
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Our support team can help with delivery, payment, or any other issue.
        </p>
        {buttons}
      </CardContent>
    </Card>
  );
}
