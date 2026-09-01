import { useEffect, useState } from "react";
import {
  getUsuariosAdmin,
  atualizarUsuarioAdmin,
  getResumoAdmin,
  type UsuarioAdmin,
} from "../api/client";

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AdminPanel({ meuId }: { meuId: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [resumo, setResumo] = useState<{
    totalUsuarios: number;
    ativos: number;
    inativos: number;
    totalConsultas: number;
  } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [u, r] = await Promise.all([getUsuariosAdmin(), getResumoAdmin()]);
      setUsuarios(u.usuarios);
      setResumo(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar usuários.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function alterar(id: string, mudancas: { ativo?: boolean; papel?: string }) {
    setSalvando(id);
    setErro(null);
    try {
      const { usuario } = await atualizarUsuarioAdmin(id, mudancas);
      setUsuarios((atual) => atual.map((u) => (u.id === id ? { ...u, ...usuario } : u)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <span className="font-mono text-xs text-tintaSuave">Administração</span>
        <h1 className="mt-1 font-display text-3xl font-medium text-tinta">Usuários</h1>
      </div>

      {resumo && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { rotulo: "Usuários", valor: resumo.totalUsuarios },
            { rotulo: "Com acesso", valor: resumo.ativos },
            { rotulo: "Desativados", valor: resumo.inativos },
            { rotulo: "Consultas", valor: resumo.totalConsultas },
          ].map((m) => (
            <div key={m.rotulo} className="rounded-card border border-borda bg-white p-4">
              <span className="font-body text-[11px] uppercase tracking-wide text-tintaSuave">
                {m.rotulo}
              </span>
              <p className="mt-1 font-mono text-2xl text-tinta">{m.valor}</p>
            </div>
          ))}
        </div>
      )}

      {erro && <p className="mb-4 font-body text-sm text-risco">{erro}</p>}
      {carregando && <p className="font-body text-sm text-tintaSuave">Carregando…</p>}

      {!carregando && (
        <div className="overflow-x-auto rounded-card border border-borda bg-white">
          <table className="w-full text-left">
            <thead className="border-b border-borda">
              <tr className="font-body text-[11px] uppercase tracking-wide text-tintaSuave">
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Consultas</th>
                <th className="px-4 py-3 font-medium">Último acesso</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Acesso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const souEu = u.id === meuId;
                return (
                  <tr key={u.id} className="border-b border-borda/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-papel font-body text-xs text-tintaSuave">
                            {u.nome.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm text-tinta">
                            {u.nome}
                            {souEu && <span className="ml-1 text-tintaSuave">(você)</span>}
                          </p>
                          <p className="truncate font-body text-[11px] text-tintaSuave">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-tinta">{u.consultas}</td>
                    <td className="px-4 py-3 font-body text-xs text-tintaSuave">
                      {formatarData(u.ultimoAcessoEm)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.papel}
                        disabled={souEu || salvando === u.id}
                        onChange={(e) => alterar(u.id, { papel: e.target.value })}
                        className="rounded-card border border-borda bg-white px-2 py-1 font-body text-xs text-tinta disabled:opacity-50"
                      >
                        <option value="USUARIO">Usuário</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={souEu || salvando === u.id}
                        onClick={() => alterar(u.id, { ativo: !u.ativo })}
                        className={`rounded-card px-3 py-1 font-body text-xs font-medium transition-colors disabled:opacity-50 ${
                          u.ativo
                            ? "bg-sucesso/10 text-sucessoDark hover:bg-sucesso/20"
                            : "bg-risco/10 text-risco hover:bg-risco/20"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Desativado"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 font-body text-[11px] leading-snug text-tintaSuave">
        Desativar remove o acesso na hora, encerrando as sessões abertas. O histórico de consultas da
        pessoa é preservado.
      </p>
    </div>
  );
}
