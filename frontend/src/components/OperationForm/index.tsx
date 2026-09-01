import type { FormState } from "./useOperationForm";
import { Field, NumberField, TextField, SelectField, Card } from "../ui/Field";
import { PriceReferenceWidget } from "../PriceReferenceWidget";
import { FreightReferenceWidget } from "../FreightReferenceWidget";

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

function BlockHeader({ n, titulo }: { n: string; titulo: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3 border-b border-borda pb-2">
      <span className="font-mono text-xs font-semibold text-azul">{n}</span>
      <h3 className="font-display text-lg font-semibold text-tinta">{titulo}</h3>
    </div>
  );
}

export function OperationForm({ form, set }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Bloco 1 — Mercadoria + Compra */}
      <Card className="p-5">
        <BlockHeader n="01" titulo="Compra" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Produto" required>
            <SelectField value={form.produto} onChange={(e) => set("produto", e.target.value as FormState["produto"])}>
              <option value="SOJA">Soja</option>
              <option value="MILHO">Milho</option>
              <option value="TRIGO">Trigo</option>
              <option value="SORGO">Sorgo</option>
              <option value="OUTRO">Outro</option>
            </SelectField>
          </Field>
          <Field label="Sacas" required>
            <NumberField
              value={form.quantidadeSacas}
              onValueChange={(v) => set("quantidadeSacas", v)}
              placeholder="50000"
            />
          </Field>
          <Field label="Preço de compra / saca (R$)" required>
            <NumberField
              value={form.precoCompraPorSaca}
              onValueChange={(v) => set("precoCompraPorSaca", v)}
              placeholder="38,00"
              step="0.01"
            />
            <PriceReferenceWidget produto={form.produto} />
          </Field>
          <Field label="Peso por saca (kg)">
            <NumberField value={form.pesoPorSacaKg} onValueChange={(v) => set("pesoPorSacaKg", v)} />
          </Field>
          <Field label="Município de origem" required>
            <TextField
              value={form.municipioOrigem}
              onChange={(e) => set("municipioOrigem", e.target.value)}
              placeholder="Alto Taquari"
            />
          </Field>
          <Field label="Estado de origem" required>
            <SelectField value={form.estadoOrigem} onChange={(e) => set("estadoOrigem", e.target.value)}>
              <option value="">UF</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Fornecedor" hint="opcional">
            <TextField value={form.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* Bloco 2 — Venda */}
      <Card className="p-5">
        <BlockHeader n="02" titulo="Venda" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Preço de venda / saca (R$)" required>
            <NumberField
              value={form.precoVendaPorSaca}
              onValueChange={(v) => set("precoVendaPorSaca", v)}
              placeholder="70,00"
              step="0.01"
            />
          </Field>
          <Field label="Comprador" hint="opcional">
            <TextField value={form.comprador} onChange={(e) => set("comprador", e.target.value)} />
          </Field>
          <Field label="Município de destino" required>
            <TextField
              value={form.municipioDestino}
              onChange={(e) => set("municipioDestino", e.target.value)}
              placeholder="Rancharia"
            />
          </Field>
          <Field label="Estado de destino" required>
            <SelectField value={form.estadoDestino} onChange={(e) => set("estadoDestino", e.target.value)}>
              <option value="">UF</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </SelectField>
          </Field>
        </div>
      </Card>

      {/* Bloco 3 — Logística */}
      <Card className="p-5">
        <BlockHeader n="03" titulo="Frete" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Frete / tonelada (R$)" hint="informado manualmente nesta fase" required>
            <NumberField
              value={form.fretePorTonelada}
              onValueChange={(v) => set("fretePorTonelada", v)}
              step="0.01"
            />
          </Field>
          <Field label="Pedágios (R$)" hint="opcional">
            <NumberField value={form.pedagios} onValueChange={(v) => set("pedagios", v)} step="0.01" />
          </Field>
          <Field label="Outros custos logísticos (R$)" hint="opcional">
            <NumberField
              value={form.outrosCustosLogisticos}
              onValueChange={(v) => set("outrosCustosLogisticos", v)}
              step="0.01"
            />
          </Field>
          <Field label="Distância (km)" hint="opcional, usado para checar o piso mínimo ANTT">
            <NumberField value={form.distanciaKm} onValueChange={(v) => set("distanciaKm", v)} />
          </Field>
          <Field label="Número de eixos" hint="opcional, do veículo/composição contratada">
            <NumberField
              value={form.numeroEixos}
              onValueChange={(v) => set("numeroEixos", v)}
              min={2}
              max={9}
            />
          </Field>
          <FreightReferenceWidget
            quantidadeSacas={form.quantidadeSacas}
            pesoPorSacaKg={form.pesoPorSacaKg}
            distanciaKm={form.distanciaKm}
            numeroEixos={form.numeroEixos}
            onUsarFrete={(valor) => set("fretePorTonelada", valor)}
          />
        </div>
      </Card>

      {/* Bloco 4 — Custos adicionais / comissões (tributação é calculada pelo tax_engine, não informada aqui) */}
      <Card className="p-5">
        <BlockHeader n="04" titulo="Comissões e custos adicionais" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Comissão de venda / saca (R$)" hint="opcional">
            <NumberField
              value={form.comissaoVendaPorSaca}
              onValueChange={(v) => set("comissaoVendaPorSaca", v)}
              step="0.01"
            />
          </Field>
          <Field label="Comissão de originação / saca (R$)" hint="opcional">
            <NumberField
              value={form.comissaoOriginacaoPorSaca}
              onValueChange={(v) => set("comissaoOriginacaoPorSaca", v)}
              step="0.01"
            />
          </Field>
          <Field label="Classificador / saca (R$)" hint="opcional">
            <NumberField
              value={form.classificadorPorSaca}
              onValueChange={(v) => set("classificadorPorSaca", v)}
              step="0.01"
            />
          </Field>
        </div>
        <p className="mt-4 text-xs text-tintaSuave">
          Tributos e fundos (ICMS, PIS, COFINS, FETHAB, SENAR e demais) são calculados automaticamente
          pelo motor tributário a partir da origem, destino e produto informados acima. Não precisa
          digitar isso aqui.
        </p>
      </Card>
    </div>
  );
}
