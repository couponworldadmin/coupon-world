import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Shield, FileText, Lock, CheckCircle2 } from 'lucide-react';

export default function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Service & Vulnerability Disclosure Policy — CouponWorld</title>
        <meta
          name="description"
          content="CouponWorld terms of service, marketplace rules, privacy commitments, and coordinated vulnerability disclosure policy."
        />
      </Helmet>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1rem',
              borderRadius: '999px',
              backgroundColor: 'var(--primary-soft)',
              color: 'var(--primary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            <Shield size={16} /> Official Platform Terms & Security Policy
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 800, color: 'var(--text-1)', marginBottom: '1rem' }}>
            Terms of Service & Security Policy
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '1.1rem', maxWidth: '680px', margin: '0 auto' }}>
            Effective Date: November 5, 2026. These terms govern your use of CouponWorld, including marketplace participation, wallet services, and responsible security research.
          </p>
        </div>

        {/* Quick Nav */}
        <div
          className="glass-card-strong"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1.25rem',
            marginBottom: '3rem',
            borderRadius: '16px',
            justifyContent: 'center',
          }}
        >
          <a href="#marketplace-terms" className="btn btn-outline" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            <FileText size={14} style={{ marginRight: '6px' }} /> Marketplace Terms
          </a>
          <a href="#security-policy" className="btn btn-outline" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            <Shield size={14} style={{ marginRight: '6px' }} /> Vulnerability Disclosure (VDP)
          </a>
          <a href="#privacy-payments" className="btn btn-outline" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            <Lock size={14} style={{ marginRight: '6px' }} /> Privacy & Payments
          </a>
        </div>

        <div style={{ display: 'grid', gap: '2.5rem' }}>
          {/* Section 1: Marketplace Terms */}
          <section id="marketplace-terms" className="glass-card-strong" style={{ padding: '2.5rem', borderRadius: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <FileText size={24} color="var(--primary)" />
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
                1. Marketplace & Account Terms
              </h2>
            </div>

            <div style={{ color: 'var(--text-2)', lineHeight: '1.7', display: 'grid', gap: '1.25rem' }}>
              <p>
                <strong>1.1 Acceptance of Agreement:</strong> By creating an account, browsing offers, or purchasing gift cards on CouponWorld, you agree to be bound by these platform terms. If you do not accept these terms, you may not access or use the platform.
              </p>
              <p>
                <strong>1.2 Account Verification:</strong> All accounts require a validated email address. Users are solely responsible for maintaining the confidentiality of their credentials and all activities occurring under their accounts.
              </p>
              <p>
                <strong>1.3 Gift Card Purchases & Redemptions:</strong> Coupons and gift cards purchased through CouponWorld are delivered digitally. Each voucher contains a unique cryptographically generated redemption code. Redemptions are single-use, verified atomically, and bound to the merchant’s redemption guidelines.
              </p>
              <p>
                <strong>1.4 Merchant Requirements:</strong> Merchants publishing offers must be verified and approved by CouponWorld administration. Merchants agree to maintain sufficient stock and honor validly purchased vouchers in accordance with the stated voucher discount or value.
              </p>
              <p>
                <strong>1.5 Wallet & Withdrawals:</strong> Wallet balances reflect settled account funds. Withdrawals are processed through verified bank routing or registered payout methods after administrative validation. Reversal of fraudulent or unauthorized transactions is subject to immediate account review.
              </p>
            </div>
          </section>

          {/* Section 2: Vulnerability Disclosure Policy (VDP) */}
          <section id="security-policy" className="glass-card-strong" style={{ padding: '2.5rem', borderRadius: '20px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Shield size={24} color="var(--primary)" />
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
                2. Coordinated Vulnerability Disclosure Policy (VDP)
              </h2>
            </div>

            <div style={{ color: 'var(--text-2)', lineHeight: '1.7', display: 'grid', gap: '1.25rem' }}>
              <p>
                Security and consumer trust are foundational to CouponWorld. We welcome reports from independent security researchers, customers, and partners who practice coordinated, responsible disclosure.
              </p>

              <div style={{ padding: '1.25rem', backgroundColor: 'var(--surface-soft)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-1)' }}>
                  Official Security Contact & Scope
                </h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.5rem' }}>
                  <li><strong>Security Contact:</strong> <a href="mailto:couponworldadmin@gmail.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>couponworldadmin@gmail.com</a></li>
                  <li><strong>Canonical Security File:</strong> <a href="/.well-known/security.txt" style={{ color: 'var(--primary)' }}>https://couponworld.live/.well-known/security.txt</a></li>
                  <li><strong>In Scope:</strong> <code>https://couponworld.live</code>, <code>https://*.couponworld.live</code>, and official backend API endpoints.</li>
                  <li><strong>Response Target:</strong> Initial acknowledgment within 24–48 hours; remediation timeline provided upon verification.</li>
                </ul>
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.5rem 0 0', color: 'var(--text-1)' }}>
                Safe Harbor Commitment
              </h3>
              <p>
                CouponWorld will not initiate legal action against security researchers for research conducted within the bounds of this policy. To qualify for Safe Harbor, researchers must:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.5rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <CheckCircle2 size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: '4px' }} />
                  <span>Promptly report vulnerabilities directly to our security contact without public disclosure prior to mutual remediation.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <CheckCircle2 size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: '4px' }} />
                  <span>Avoid accessing, copying, modifying, or destroying real customer records, financial balances, or private data.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <CheckCircle2 size={18} color="var(--green)" style={{ flexShrink: 0, marginTop: '4px' }} />
                  <span>Do not perform Denial of Service (DoS/DDoS), automated resource exhaustion, spam, or social engineering attacks against our staff or users.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3: Privacy & Payment Protections */}
          <section id="privacy-payments" className="glass-card-strong" style={{ padding: '2.5rem', borderRadius: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Lock size={24} color="var(--secondary)" />
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
                3. Privacy & Payment Protections
              </h2>
            </div>

            <div style={{ color: 'var(--text-2)', lineHeight: '1.7', display: 'grid', gap: '1.25rem' }}>
              <p>
                <strong>3.1 Client Storage Protections:</strong> In accordance with our security hardening standards, CouponWorld does not store payment credentials, payment email addresses, or sensitive personal information in browser <code>localStorage</code>. All payment references and customer profiles are maintained securely in encrypted server-side databases.
              </p>
              <p>
                <strong>3.2 Payment Gateway Standards:</strong> All credit card, UPI, and digital wallet checkouts are processed through certified PCI-DSS Level 1 compliant partners (Stripe, Razorpay, PayPal). CouponWorld servers never receive or store raw card numbers or CVVs.
              </p>
              <p>
                <strong>3.3 Server-Side Settlement Verification:</strong> All payment captures are cryptographically validated directly with gateway APIs before balances or vouchers are issued, preventing client-side price or currency tampering.
              </p>
            </div>
          </section>
        </div>

        {/* Back Link */}
        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
            Return to Marketplace Home
          </Link>
        </div>
      </div>
    </>
  );
}
