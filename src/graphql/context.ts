import { FastifyRequest } from 'fastify';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../types/auth-context';
import Sentry from '../lib/sentry';

export const getContext = async (req: FastifyRequest): Promise<AuthContext> => {
    const apiKey = (req.headers['wize-api-key'] as string)?.trim();

    if (!apiKey) {
        Sentry.captureMessage('Missing wize-api-key header');
        throw new Error('Missing wize-api-key header');
    }

    const { data, error } = await supabase
        .schema('api')
        .from('api_keys')
        .select('tenant_id, scopes')
        .eq('key', apiKey)
        .eq('is_active', true)
        .maybeSingle();

    if (error || !data) {
        Sentry.captureMessage('Invalid or disabled API key: ' + apiKey);
        Sentry.captureException(error || new Error('Invalid or disabled API key'));
        throw new Error('Invalid or disabled API key');
    }

    try {
        await supabase
            .schema('api')
            .from('api_keys')
            .update({ last_used_at: new Date() })
            .eq('key', apiKey);
    } catch (updateError: any) {
        Sentry.captureMessage('⚠️ Failed to update last_used_at:', updateError);
        Sentry.captureException(updateError);
    }

    return {
        user: { id: '00000000-0000-0000-0000-000000000000' },
        tenantId: data.tenant_id,
        scopes: data.scopes || []
    };
};

// Optional helper for resolver scope checks
export const hasScope = (ctx: AuthContext, scope: string) => ctx.scopes?.includes(scope);