import { ResendConfirmationForm } from '@/components/auth/resend-confirmation-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ResendConfirmationPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resend confirmation email</CardTitle>
        <CardDescription>
          Enter your email address to receive a new confirmation link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResendConfirmationForm />
      </CardContent>
    </Card>
  );
}
