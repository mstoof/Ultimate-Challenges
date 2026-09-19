/**
 * Bewust kale HTML met inline styles: mailclients negeren <style> blocks,
 * externe CSS en de helft van moderne layout. Tabellen en inline styles
 * zijn wat overal werkt.
 */
export function magicLinkEmail(url: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EDEEE8;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:4px;padding:32px;">
        <tr>
          <td style="font-size:22px;font-weight:bold;color:#17251E;padding-bottom:8px;">Ultimate Challenges</td>
        </tr>
        <tr>
          <td style="font-size:15px;line-height:1.6;color:#17251E;padding-bottom:24px;">
            Klik op de knop om in te loggen. De link werkt 15 minuten en daarna niet meer.
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:24px;">
            <a href="${url}" style="display:inline-block;background:#17251E;color:#EDEEE8;text-decoration:none;padding:14px 24px;border-radius:3px;font-size:15px;font-weight:bold;">Inloggen</a>
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;line-height:1.6;color:#6B7A70;">
            Werkt de knop niet? Plak deze link in je browser:<br />
            <span style="word-break:break-all;">${url}</span>
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;line-height:1.6;color:#6B7A70;padding-top:20px;border-top:1px solid #D6D9D0;">
            Niet zelf aangevraagd? Dan hoef je niets te doen, zonder klik gebeurt er niks.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
