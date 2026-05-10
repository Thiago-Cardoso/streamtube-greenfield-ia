import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmailConfirmation } from '@/components/auth/email-confirmation';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>
            This confirmation link is missing the token. Please use the link from your email.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <EmailConfirmation token={token} />;
}
