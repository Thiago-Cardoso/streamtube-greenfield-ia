import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>
            This reset link is missing the token. Please use the link from your email.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} />;
}
