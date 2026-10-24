import { z } from "zod";

export const orderFormSchema = z
  .object({
    clientName: z.string().trim().min(2, "Informe o cliente ou a loja."),
    laboratoryId: z.string().uuid("Selecione o laboratório."),
    sellerId: z.string().uuid().or(z.literal("")).optional(),
    storeId: z.string().uuid().or(z.literal("")).optional(),
    enteredAt: z.string().min(1, "Informe a entrada."),
    dueAt: z.string().optional(),
    notes: z.string().optional(),
    serviceDescription: z.string().trim().min(3, "Descreva o serviço."),
    externalOrderId: z.string().optional(),
    priority: z.enum(["normal", "critica"]),
    status: z.enum(["aguardando_lentes", "aguardando_montagem"]),
    odSphere: z.string().optional(),
    odCylinder: z.string().optional(),
    odAxis: z.string().optional(),
    oeSphere: z.string().optional(),
    oeCylinder: z.string().optional(),
    oeAxis: z.string().optional(),
    addition: z.string().optional(),
    frame: z.string().optional(),
    lensNotes: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.dueAt && value.enteredAt && value.dueAt < value.enteredAt) {
      context.addIssue({
        code: "custom",
        path: ["dueAt"],
        message: "A previsão não pode ser anterior à entrada.",
      });
    }
  });

export const stockFormSchema = z.object({
  manufacturer: z.string().optional(),
  brand: z.string().optional(),
  material: z.string().optional(),
  refractiveIndex: z.string().optional(),
  treatment: z.string().optional(),
  color: z.string().optional(),
  diameterMm: z.string().optional(),
  sphere: z.string().min(1, "Informe o grau esférico."),
  cylinder: z.string().min(1, "Informe o grau cilíndrico."),
  addition: z.string().optional(),
  lensType: z.string().optional(),
  lotCode: z.string().optional(),
  location: z.string().optional(),
  minQty: z.coerce.number().int().min(0),
  idealQty: z.coerce.number().int().min(0),
  initialQty: z.coerce.number().int().min(0),
  unitCost: z.string().optional(),
  notes: z.string().optional(),
  isSpecial: z.boolean().optional(),
});

export const movementSchema = z.object({
  stockId: z.string().uuid(),
  type: z.enum(["entrada", "saida", "ajuste", "devolucao", "correcao", "consumo"]),
  quantity: z.coerce.number().int(),
  reason: z.string().trim().min(3, "Informe o motivo."),
  orderId: z.string().uuid().or(z.literal("")).optional(),
  lot: z.string().optional(),
  allowNegative: z.boolean().optional(),
});
