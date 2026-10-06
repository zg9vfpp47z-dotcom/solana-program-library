import React, { useState } from 'react';
import Layout from '@theme/Layout';
import styles from './token-checker.module.css';

const RPC_URL = 'https://api.mainnet-beta.solana.com';
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKEN_PROGRAMS = {
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: 'SPL Token',
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: 'Token-2022',
};
const EXTENSION_LABELS = {
  transferFeeConfig: 'Comisiones de transferencia configuradas',
  transferHook: 'Programa de transferencia adicional (transfer hook)',
  permanentDelegate: 'Delegado permanente configurado',
  defaultAccountState: 'Estado predeterminado de las cuentas',
  mintCloseAuthority: 'Autoridad para cerrar el mint',
  confidentialTransferMint: 'Transferencias confidenciales habilitadas',
  nonTransferable: 'Token no transferible',
};

function isValidAddress(address) {
  if (!ADDRESS_PATTERN.test(address)) return false;
  const bytes = [0];
  for (const character of address) {
    let carry = BASE58_ALPHABET.indexOf(character);
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const leadingOnes = address.match(/^1*/)[0].length;
  const decodedLength =
    leadingOnes === address.length ? leadingOnes : bytes.length + leadingOnes;
  return decodedLength === 32;
}

function displaySupply(supply, decimals) {
  if (!/^\d+$/.test(String(supply)) || !Number.isInteger(decimals)) {
    return `${supply} unidades mínimas`;
  }
  const digits = String(supply).padStart(decimals + 1, '0');
  if (decimals === 0) return digits;
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function authorityLabel(authority) {
  if (authority === null) return 'No configurada actualmente';
  return authority
    ? 'Activa: puede ejercer autoridad'
    : 'No informada por el RPC';
}

function TokenChecker() {
  const [address, setAddress] = useState('');
  const [mint, setMint] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function checkMint(event) {
    event.preventDefault();
    setMint(null);
    setError('');
    const account = address.trim();
    if (!isValidAddress(account)) {
      setError(
        'Introduce una dirección Solana válida (clave pública base58 de 32 bytes).',
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [
            account,
            { encoding: 'jsonParsed', commitment: 'confirmed' },
          ],
        }),
      });
      if (!response.ok)
        throw new Error(
          'El servicio RPC no está disponible. Inténtalo de nuevo.',
        );
      const result = await response.json();
      if (result.error)
        throw new Error(
          result.error.message || 'No se pudo consultar la cuenta.',
        );
      const value = result.result?.value;
      if (!value)
        throw new Error('No se encontró esta cuenta en Solana Mainnet.');
      if (value.data?.parsed?.type !== 'mint') {
        throw new Error(
          'La dirección existe, pero el RPC no la reconoce como un mint de token.',
        );
      }
      setMint({
        address: account,
        owner: value.owner,
        info: value.data.parsed.info,
        extensions: value.data.parsed.info.extensions || [],
      });
    } catch (requestError) {
      setError(requestError.message || 'Ocurrió un error al consultar Solana.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout
      title="Verificador de tokens"
      description="Consulta datos públicos de un mint de Solana"
    >
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>
            HERRAMIENTA EXPERIMENTAL · SOLANA MAINNET
          </p>
          <h1>Verificador de tokens</h1>
          <p>
            Revisa autoridades y extensiones visibles de un mint usando datos
            públicos de Solana. Sin conectar una wallet.
          </p>
          <form className={styles.form} onSubmit={checkMint}>
            <label htmlFor="mint-address">Dirección del mint</label>
            <div className={styles.inputRow}>
              <input
                id="mint-address"
                autoComplete="off"
                spellCheck="false"
                placeholder="Pega una dirección de mint"
                value={address}
                disabled={loading}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setMint(null);
                  setError('');
                }}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Consultando…' : 'Analizar mint'}
              </button>
            </div>
          </form>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>

        <p className={styles.visuallyHidden} role="status" aria-live="polite">
          {mint ? `Análisis completado para el mint ${mint.address}.` : ''}
        </p>
        <div>
          {mint && (
            <section className={styles.results}>
            <div className={styles.resultHeading}>
              <div>
                <p className={styles.eyebrow}>INFORME DE CUENTA</p>
                <h2>Datos del mint</h2>
              </div>
              <a
                className={styles.explorer}
                href={`https://explorer.solana.com/address/${encodeURIComponent(
                  mint.address,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver en Solana Explorer ↗
              </a>
            </div>
            <dl className={styles.grid}>
              <div className={styles.metric}>
                <dt>Programa</dt>
                <dd>{TOKEN_PROGRAMS[mint.owner] || 'Programa desconocido'}</dd>
                <small>{mint.owner}</small>
              </div>
              <div className={styles.metric}>
                <dt>Oferta actual</dt>
                <dd>{displaySupply(mint.info.supply, mint.info.decimals)}</dd>
                <small>{mint.info.decimals} decimales</small>
              </div>
              <div className={styles.metric}>
                <dt>Autoridad de emisión</dt>
                <dd>{authorityLabel(mint.info.mintAuthority)}</dd>
                {mint.info.mintAuthority && (
                  <small>{mint.info.mintAuthority}</small>
                )}
              </div>
              <div className={styles.metric}>
                <dt>Autoridad de congelación</dt>
                <dd>{authorityLabel(mint.info.freezeAuthority)}</dd>
                {mint.info.freezeAuthority && (
                  <small>{mint.info.freezeAuthority}</small>
                )}
              </div>
            </dl>
            <div className={styles.extensions}>
              <h3>Extensiones reportadas por el RPC</h3>
              {mint.extensions.length ? (
                <ul>
                  {mint.extensions.map((item, index) => (
                    <li
                      key={`${
                        item.extension || item.type || 'extension'
                      }-${index}`}
                    >
                      <strong>
                        {EXTENSION_LABELS[item.extension] ||
                          item.extension ||
                          item.type ||
                          'Extensión detectada'}
                      </strong>
                      {item.state && <span>{JSON.stringify(item.state)}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No se reportaron extensiones en la respuesta del RPC.</p>
              )}
            </div>
            <p className={styles.disclaimer}>
              Este informe refleja los datos que devuelve el RPC en el momento
              de la consulta. No es una auditoría ni garantiza que un token sea
              seguro; la ausencia de extensiones reportadas tampoco confirma que
              no existan.
            </p>
            </section>
          )}
        </div>
        <p className={styles.footnote}>
          El RPC público puede limitar solicitudes. La herramienta solo consulta
          datos y nunca solicita firmas ni claves privadas.
        </p>
      </main>
    </Layout>
  );
}

export default TokenChecker;
