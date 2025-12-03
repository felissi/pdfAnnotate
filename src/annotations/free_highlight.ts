import { CryptoInterface } from "../parser";
import { Util } from "../util";
import { WriterUtil } from "../writer-util";
import { ErrorList } from "./annotation_errors";
import { MarkupAnnotationObj } from "./annotation_types";
import { InkAnnotationObj } from "./ink_annotation";
import { InvalidAnnotationTypeError } from "./annotation_errors";
import {
  AppStream,
  GraphicsStateParameter,
  XObjectObj,
} from "../appearance-stream";
import { ContentStream } from "../content-stream";
import { Resource } from "../resources";

export class FreeHighlightAnnotationObj extends InkAnnotationObj {
  strokeWidth: number;
  constructor(params: { strokeWidth: number }) {
    super();
    this.type = "/FreeHighlight";
    this.strokeWidth = params.strokeWidth;
    this.border && (this.border.border_width = this.strokeWidth);
  }
  public writeAnnotationObject(cryptoInterface: CryptoInterface): number[] {
    let ret: number[] =
      MarkupAnnotationObj.prototype.writeAnnotationObject.call(
        this,
        cryptoInterface
      );
    ret = ret.concat(WriterUtil.IT);
    ret.push(WriterUtil.SPACE);
    ret = ret.concat(Util.convertStringToAscii("/InkHighlight"));
    ret.push(WriterUtil.SPACE);

    if (this.inkList && this.inkList.length > 0) {
      ret = ret.concat(WriterUtil.INKLIST);
      ret.push(WriterUtil.SPACE);
      ret = ret.concat(WriterUtil.writeNestedNumberArray(this.inkList));
      ret.push(WriterUtil.SPACE);
    }

    return ret;
  }
  public validate(enact?: boolean): ErrorList {
    let errorList: ErrorList = MarkupAnnotationObj.prototype.validate.call(
      this,
      enact
    );

    if (this.type !== "/FreeHighlight") {
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
  public createDefaultAppearanceStream(): void {
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

    /* ------------------------------------ */

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
    if (true) {
      const blendModeGs = new GraphicsStateParameter(
        this.factory.parser.getFreeObjectId()
      );
      blendModeGs.blendMode = "/Multiply";
      this.additional_objects_to_write.push({
        obj: blendModeGs,
        func: (ob: any) => ob.writeGStateParameter(),
      });
      const blendModeRes = new Resource();
      blendModeRes.addGStateDef({
        name: "/BlendMode0",
        refPtr: blendModeGs.object_id,
      });
      go.addOperator("gs", ["/BlendMode0"]);
      xobj.resources = blendModeRes;
    }
    go.setLineColor(this.color);
    for (let inkl of this.inkList) {
      go.drawPolygon(inkl, this.strokeWidth);
    }

    /* ------------------------------------ */

    this.appearanceStream.N = xobj;
    this.additional_objects_to_write.push({
      obj: xobj,
      func: (ob: any, cryptoInterface: CryptoInterface) =>
        ob.writeXObject(cryptoInterface),
    });
  }
}
