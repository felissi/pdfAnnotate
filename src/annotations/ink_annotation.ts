import { MarkupAnnotation, MarkupAnnotationObj } from "./annotation_types";
import { ErrorList, InvalidAnnotationTypeError } from "./annotation_errors";
import { CryptoInterface } from "../parser";
import { WriterUtil } from "../writer-util";
import {
  AppStream,
  XObjectObj,
  GraphicsStateParameter,
} from "../appearance-stream";
import { Resource } from "../resources";
import { ContentStream, GraphicsObject } from "../content-stream";
import { Util } from "../util";

export interface InkAnnotation extends MarkupAnnotation {
  inkList: number[][]; // /InkList
  borderStyle?: any; // /BS
}

export class InkAnnotationObj
  extends MarkupAnnotationObj
  implements InkAnnotation
{
  inkList: number[][] = [];
  lines: number[][] | number[] | undefined;
  strokeWidth: number;
  linecap: "miter" | "round" | "bevel";
  linejoin: "butt" | "round" | "square";

  constructor(
    params: {
      lines?: number[][] | number[] | undefined;
      strokeWidth?: number;
      createDefaultAppearanceStream?: boolean;
      linecap?: "miter" | "round" | "bevel";
      linejoin?: "butt" | "round" | "square";
    } = {}
  ) {
    super();
    this.type = "/Ink";
    this.type_encoded = [47, 73, 110, 107]; // = '/Ink'
    this.lines = params.lines;

    this.strokeWidth = params.strokeWidth ?? 1;
    this.linecap = params.linecap || "round";
    this.linejoin = params.linejoin || "round";
    // this.miterlimit?: number;
    if (params.lines) {
      this.border = undefined;
    }
  }

  public writeAnnotationObject(cryptoInterface: CryptoInterface): number[] {
    let ret: number[] = super.writeAnnotationObject(cryptoInterface);

    ret.push(WriterUtil.SPACE);
    ret = ret.concat(Util.convertStringToAscii("/BS"));
    ret.push(WriterUtil.SPACE);
    ret = ret.concat(WriterUtil.DICT_START);
    ret.push(WriterUtil.SPACE);
    ret = ret.concat(Util.convertStringToAscii("/W"));
    ret.push(WriterUtil.SPACE);
    ret = ret.concat(Util.convertNumberToCharArray(this.strokeWidth));
    ret.push(WriterUtil.SPACE);
    ret = ret.concat(WriterUtil.DICT_END);
    ret.push(WriterUtil.SPACE);

    if (this.inkList && this.inkList.length > 0) {
      ret = ret.concat(WriterUtil.INKLIST);
      ret.push(WriterUtil.SPACE);
      ret = ret.concat(WriterUtil.writeNestedNumberArray(this.inkList));
      ret.push(WriterUtil.SPACE);
    }

    return ret;
  }

  public validate(enact: boolean = true): ErrorList {
    let errorList: ErrorList = super.validate(false);

    if (this.type !== "/Ink") {
      errorList.push(
        new InvalidAnnotationTypeError(`Invalid annotation type ${this.type}`)
      );
    }

    if ("number" === typeof this.inkList[0]) {
      this.inkList = [this.inkList] as any;
    }

    if (enact) {
      for (let error of errorList) {
        throw error;
      }
    }

    return errorList;
  }

  public createDefaultAppearanceStream() {
    this.appearanceStream = new AppStream(this);
    this.appearanceStream.new_object = true;
    let xobj = new XObjectObj();
    xobj.object_id = this.factory.parser.getFreeObjectId();
    xobj.new_object = true;
    xobj.bBox = this.rect;
    xobj.matrix = [1, 0, 0, 1, -this.rect[0], -this.rect[1]];
    let cs = new ContentStream();
    xobj.contentStream = cs;
    let cmo = cs.addMarkedContentObject(["/Tx"]);
    let go = cmo.addGraphicObject();

    if (this.opacity !== 1) {
      go.addOperator("gs", ["/GParameters"]);

      let gsp = new GraphicsStateParameter(
        this.factory.parser.getFreeObjectId()
      );
      gsp.CA = gsp.ca = this.opacity;
      this.additional_objects_to_write.push({
        obj: gsp,
        func: (ob: any) => ob.writeGStateParameter(),
      });
      let res = new Resource();
      res.addGStateDef({ name: "/GParameters", refPtr: gsp.object_id });
      xobj.resources = res;
    }

    go.setLineColor(this.color).setFillColor(this.color);
    // go.setLineWidth(this.strokeWidth);
    if (this.lines) {
      const _lines: number[][] = Array.isArray(this.lines[0])
        ? (this.lines as number[][])
        : [this.lines as number[]];
      for (const segment of _lines) {
        drawCurve(go, segment, {
          linewidth: this.strokeWidth,
          linecap: this.linecap,
          linejoin: this.linejoin,
          //   miterlimit: this.miterlimit,
          end: false,
        });
      }
      go.addOperator("S");
    } else {
      for (let inkl of this.inkList) {
        go.drawPolygon(inkl);
      }
    }

    this.appearanceStream.N = xobj;
    this.additional_objects_to_write.push({
      obj: xobj,
      func: (ob: any, cryptoInterface: CryptoInterface) =>
        ob.writeXObject(cryptoInterface),
    });
  }
}
function drawCurve(
  go: GraphicsObject,
  points: (number | null | undefined)[],
  {
    linewidth = 2,
    linecap = "round",
    linejoin = "round",
    miterlimit,
    end = true,
  }: {
    linewidth?: number;
    linecap?: "miter" | "round" | "bevel";
    linejoin?: "butt" | "round" | "square";
    miterlimit?: number | undefined;
    end?: boolean;
  }
) {
  if (points.length % 6 !== 0) {
    throw Error(
      "Number of points must be multiple of 6. Prepend NaN or null to the head of the array."
    );
  }
  const linecapEnum = {
    miter: 0,
    round: 1,
    bevel: 2,
  };

  const linejoinEnum = {
    butt: 0,
    round: 1,
    square: 2,
  };

  go.addOperator("w", [linewidth]);
  go.addOperator("J", [linecapEnum[linecap]]);
  go.addOperator("j", [linejoinEnum[linejoin]]);
  miterlimit && go.addOperator("M", [miterlimit]);

  go.addOperator("m", [points[4], points[5]]);
  for (let i = 6; i < points.length; i += 6) {
    go.addOperator("c", [
      points[i],
      points[i + 1],
      points[i + 2],
      points[i + 3],
      points[i + 4],
      points[i + 5],
    ]);
  }
  if (end) {
    go.addOperator("S");
  }
  return go;
}
